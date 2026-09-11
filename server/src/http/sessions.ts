// CRUD برای جلسات — همیشه از مسیر مراجعِ متعلق به تراپیستِ واردشده
import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { requireAuth } from '../auth/guard.js';
import { getOwnedClient, getOwnedSession } from '../db/ownership.js';
import {
  enqueueBatch,
  pendingAudioFor,
  processBatchQueue,
  validateAudioBuffer,
} from '../stt/batchqueue.js';

// ⭐ پردازش صدا در background (طبق الگوی مستندات Soniox)
async function processVoiceNoteInBackground(sessionId: string, buffer: Buffer) {
  try {
    const sonioxKey = process.env.SONIOX_API_KEY;
    if (!sonioxKey) return;

    const { SonioxEngine } = await import('../stt/soniox.js');

    let finalText = '';

    const engine = new SonioxEngine(sonioxKey, {
      onPreview: () => {},
      onStatus: (status) => { console.log('[voice-note] status:', status); },
      onFinished: (text) => { finalText = text; },
      onError: (err) => { console.log('[voice-note] Soniox error:', err); },
    });

    console.log('[voice-note] starting engine, size:', buffer.length);

    await engine.start();

    // ⭐ طبق مستندات: chunks of 3840 bytes + 120ms pause (شبیه streaming واقعی)
    const CHUNK_SIZE = 3840;
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.subarray(i, Math.min(i + CHUNK_SIZE, buffer.length));
      engine.sendAudioChunk(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    console.log('[voice-note] audio sent, finalizing...');

    // stop() حالا ws.send('') رو می‌فرسته — سیگنال پایان صدا
    const text = await engine.stop();

    console.log('[voice-note] finished, text length:', (text || '').length);

    if (text && text.trim()) {
      await query(
        `INSERT INTO session_notes (session_id, type, text, wall_clock)
         VALUES ($1, 'voice', $2, $3)`,
        [sessionId, text.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
      );
      console.log('[voice-note] ✓ saved to DB');
    } else {
      console.log('[voice-note] no text extracted');
    }
  } catch (err) {
    console.log('[voice-note] background error:', String(err));
  }
}

export async function sessionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // POST /api/sessions — شروع جلسه‌ی جدید (مراجع باید مالِ همین تراپیست باشه)
  app.post('/api/sessions', async (request, reply) => {
    const { client_id, consent, date, start_time } = request.body as {
      client_id: string;
      consent: boolean;
      date?: string;
      start_time?: string;
    };

    if (!consent) {
      reply.code(400);
      return { error: 'رضایت مراجع الزامی است' };
    }

    const client = await getOwnedClient(client_id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    const lastNum = await query(
      'SELECT COALESCE(MAX(session_num), 0) + 1 as next FROM sessions WHERE client_id = $1',
      [client_id]
    );
    const sessionNum = lastNum.rows[0].next;

    const now = new Date();
    const defaultDate = date || `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const defaultTime = start_time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = await query(
      `INSERT INTO sessions (client_id, session_num, date, start_time, consent, status)
       VALUES ($1, $2, $3, $4, $5, 'in_progress')
       RETURNING *`,
      [client_id, sessionNum, defaultDate, defaultTime, true]
    );

    reply.code(201);
    return {
      session: result.rows[0],
      client: { code: client.code, alias: client.alias },
    };
  });

  // GET /api/sessions/:id — جزئیات جلسه + یادداشت‌ها
  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const sessionResult = await query(
      `SELECT s.*, c.code, c.alias
       FROM sessions s
       JOIN clients c ON c.id = s.client_id
       WHERE s.id = $1 AND c.therapist_id = $2`, [id, request.therapistId]
    );

    if (sessionResult.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const notesResult = await query(
      'SELECT * FROM session_notes WHERE session_id = $1 ORDER BY offset_ms NULLS LAST, created_at',
      [id]
    );

    return {
      session: sessionResult.rows[0],
      notes: notesResult.rows,
    };
  });

  // PUT /api/sessions/:id — با محافظ نسخه برای transcript (جلوگیری از overwrite stale)
  app.put('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      transcript?: string;
      transcript_version?: number;
      realtime_reliable?: boolean;
      stt_mode?: string;
      anchors?: Array<{ chars: number; off: number }>;
      duration_ms?: number;
      status?: string;
      date?: string;
      start_time?: string;
    };

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (body.transcript !== undefined) {
      // ✅ Compare-and-swap: اگر caller نسخه‌ی پایه بفرستد و با DB نخورد → 409، نه overwrite.
      // callerهای قدیمی (بدون transcript_version) همچنان پذیرفته‌اند (سازگاری عقبرو).
      if (typeof body.transcript_version === 'number') {
        const curV = await query('SELECT transcript_version FROM sessions WHERE id = $1', [id]);
        const cv: number = curV.rows[0]?.transcript_version ?? 0;
        if (cv !== body.transcript_version) {
          reply.code(409);
          return {
            error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید',
            code: 'version-conflict',
            current_version: cv,
          };
        }
      }
      updates.push(`transcript = $${paramCount++}`);
      values.push(body.transcript);
      // هر write موفق، نسخه را یکی جلو می‌برد — اتمیک در همین UPDATE
      updates.push(`transcript_version = transcript_version + 1`);
    }
    if (body.realtime_reliable !== undefined) {
      updates.push(`realtime_reliable = $${paramCount++}`);
      values.push(body.realtime_reliable);
    }
    if (body.stt_mode !== undefined) {
      updates.push(`stt_mode = $${paramCount++}`);
      values.push(body.stt_mode);
    }
    if (body.anchors !== undefined) {
      updates.push(`anchors = $${paramCount++}`);
      values.push(JSON.stringify(body.anchors));
    }
    if (body.duration_ms !== undefined) {
      updates.push(`duration_ms = $${paramCount++}`);
      values.push(body.duration_ms);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(body.status);
    }
    if (body.date !== undefined) {
      updates.push(`date = $${paramCount++}`);
      values.push(body.date);
    }
    if (body.start_time !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(body.start_time);
    }

    if (updates.length === 0) {
      reply.code(400);
      return { error: 'چیزی برای به‌روزرسانی نیست' };
    }

    updates.push(`updated_at = now()`);
    values.push(id);
    values.push(request.therapistId);

    const result = await query(
      `UPDATE sessions SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND client_id IN (SELECT id FROM clients WHERE therapist_id = $${paramCount + 1})
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    return { session: result.rows[0] };
  });

  // DELETE /api/sessions/:id
  app.delete('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const result = await query(
      `DELETE FROM sessions
       WHERE id = $1 AND client_id IN (SELECT id FROM clients WHERE therapist_id = $2)
       RETURNING id`,
      [id, request.therapistId]
    );

    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    return { deleted: id };
  });

  // POST /api/sessions/:id/notes — افزودن یادداشت/علامت
  app.post('/api/sessions/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, text, sign_type, offset_ms, wall_clock } = request.body as {
      type: 'note_during' | 'note_after' | 'sign' | 'voice';
      text?: string;
      sign_type?: string;
      offset_ms?: number;
      wall_clock?: string;
    };

    if (!type) {
      reply.code(400);
      return { error: 'type الزامی است' };
    }

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const result = await query(
      `INSERT INTO session_notes (session_id, type, text, sign_type, offset_ms, wall_clock)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, type, text || null, sign_type || null, offset_ms || null, wall_clock || null]
    );

    reply.code(201);
    return { note: result.rows[0] };
  });

  // DELETE /api/notes/:id — حذف یادداشت
  app.delete('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await query(
      `DELETE FROM session_notes n USING sessions s, clients c
       WHERE n.id = $1 AND n.session_id = s.id AND s.client_id = c.id AND c.therapist_id = $2
       RETURNING n.id`,
      [id, request.therapistId]
    );

    if (result.rows.length === 0) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }
    return { deleted: id };
  });

  // ⭐ آپلود فایل صوتی — async (فوری جواب، پردازش در background)
  app.post('/api/sessions/:id/voice-note', async (request, reply) => {
    const { id } = request.params as { id: string };

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const file = await (request as any).file();
    if (!file) {
      reply.code(400);
      return { error: 'فایل صوتی ارسال نشده' };
    }

    const buffer = await file.toBuffer();

    if (buffer.length > 50 * 1024 * 1024) {
      reply.code(400);
      return { error: 'فایل صوتی بیش از حد بزرگ است' };
    }

    if (buffer.length < 100) {
      reply.code(400);
      return { error: 'فایل صوتی خیلی کوتاه است' };
    }

    const sonioxKey = process.env.SONIOX_API_KEY;
    if (!sonioxKey) {
      reply.code(500);
      return { error: 'کلید Soniox تنظیم نشده' };
    }

    console.log('[voice-note] received, size:', buffer.length, 'bytes — processing in background');

    // ⭐ فوری جواب بده (202) — تراپیست منتظر نمی‌مونه
    processVoiceNoteInBackground(id, buffer).catch(() => {});

    reply.code(202);
    return {
      status: 'processing',
      message: 'صدا دریافت شد — در حال رونویسی',
    };
  });

  // ===== Batch fallback (فقط مسیر شکست realtime) =====
  // حریم خصوصی: صوت فقط وقتی به سرور می‌آید که realtime ناموفق/غیرقابل‌اعتماد باشد.
  // بعد از رونویسی موفق، فایل صوتی حذف می‌شود. GET این فایل از هیچ مسیری سرو نمی‌شود.
  // ?purpose=transcript (پیش‌فرض) → merge در sessions.transcript
  // ?purpose=note → فقط session_notes(type='voice')، هرگز transcript (ISSUE 3)
  app.post('/api/sessions/:id/batch-audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purpose = ((request.query as any)?.purpose === 'note' ? 'note' : 'transcript') as
      import('../stt/batchqueue.js').BatchPurpose;

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    if (owned.status === 'completed' || owned.status === 'canceled') {
      reply.code(400);
      return { error: 'جلسه پایان یافته است' };
    }

    const file = await (request as any).file();
    if (!file) {
      reply.code(400);
      return { error: 'فایل صوتی ارسال نشده' };
    }
    const buffer: Buffer = await file.toBuffer();
    const problem = validateAudioBuffer(buffer);
    if (problem) {
      reply.code(400);
      return { error: problem };
    }

    const { baseVersion } = await enqueueBatch(id, buffer, purpose);
    // پردازش ناهمگام؛ اگر egress قطع باشد queued می‌ماند و با retry بعدی جلو می‌رود
    processBatchQueue(id, purpose).catch(() => {});

    reply.code(202);
    return { status: 'queued', purpose, message: 'صوت در صف رونویسی قرار گرفت', base_version: baseVersion };
  });

  app.get('/api/sessions/:id/batch-status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const hasAudio = !!pendingAudioFor(id, 'transcript');
    const hasNoteAudio = !!pendingAudioFor(id, 'note');
    return {
      batch_status: owned.batch_status ?? null,
      stt_mode: owned.stt_mode ?? null,
      realtime_reliable: owned.realtime_reliable ?? null,
      transcript_version: owned.transcript_version ?? 0,
      audio_pending: hasAudio,
      note_audio_pending: hasNoteAudio,
    };
  });

  app.post('/api/sessions/:id/batch-retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purpose = ((request.query as any)?.purpose === 'note' ? 'note' : 'transcript') as
      import('../stt/batchqueue.js').BatchPurpose;
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    if (!pendingAudioFor(id, purpose)) {
      reply.code(400);
      return { error: 'صوتی در صف نیست' };
    }
    processBatchQueue(id, purpose).catch(() => {});
    return { status: 'retrying', purpose };
  });
}
