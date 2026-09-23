// CRUD برای جلسات — همیشه از مسیر مراجعِ متعلق به تراپیستِ واردشده
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { query, pool } from '../db/connection.js';
import { requireAuth } from '../auth/guard.js';
import { getOwnedClient, getOwnedSession } from '../db/ownership.js';
import {
  INVALID_DATE_ERROR,
  INVALID_TIME_ERROR,
  normalizeSessionDate,
  normalizeStartTime,
  nowInTehran,
} from './sessionDate.js';
import {
  enqueueBatch,
  pendingAudioFor,
  processBatchQueue,
  validateAudioBuffer,
} from '../stt/batchqueue.js';
import { getResolveJob, startResolveSpeakers } from '../stt/speakerResolve.js';
import { listSessionAudio, deleteSessionAudioDirs } from '../stt/sessionAudioArchive.js';
import { logEvent } from '../obs/eventLog.js';
import { generateCaseFile } from '../features/case-file/application/generateCaseFile.js';
import { SqlCaseFileRepository } from '../features/case-file/adapters/repository/caseFileRepository.sql.js';
import { resolveLLMProvider } from '../features/case-file/adapters/llm/registry.js';

const autoCaseFileRepo = new SqlCaseFileRepository();

// خودکارسازیِ تولیدِ پرونده بعدِ پایانِ کاملِ جلسه (فازِ ۲ِ Module 08) — fire-and-forget:
// هرگز پاسخِ HTTPِ اصلیِ ثبت/به‌روزرسانیِ جلسه را بلاک یا fail نمی‌کند. قفلِ نرم و
// corpus_signature در generateCaseFile خودش از دوبار-تولیدِ هم‌زمان (مثلاً کلیکِ دستیِ
// هم‌زمانِ تراپیست) جلوگیری می‌کند — منطقِ اضافه‌ای اینجا لازم نیست.
async function maybeAutoGenerateCaseFile(clientId: string, therapistId: string): Promise<void> {
  try {
    const therapistRow = await query(
      'SELECT case_file_auto_generate, case_file_enabled FROM therapists WHERE id = ?',
      [therapistId]
    );
    // فیچرِ پرونده فقط برایِ حسابِ دارایِ case_file_enabled (migration 022) — همان گاردِ requireCaseFileAccess.
    if (!therapistRow.rows[0]?.case_file_enabled) return;
    if (therapistRow.rows[0]?.case_file_auto_generate !== true) return;

    const clientRow = await query(
      'SELECT category, gender, alias, status FROM clients WHERE id = ? AND therapist_id = ?',
      [clientId, therapistId]
    );
    const client = clientRow.rows[0];
    // فعلاً فقط مراجعینِ غیرفعال — هم‌راستا با محدودیتِ فعلیِ UIِ بخشِ پرونده؛
    // گسترش به مراجعینِ فعال به فازِ بعدی موکول شده.
    if (!client || client.status !== 'inactive') return;

    const llmProvider = resolveLLMProvider();
    await generateCaseFile(
      clientId,
      { category: client.category ?? null, gender: client.gender ?? null, alias: client.alias ?? null },
      { llmProvider, caseFileRepo: autoCaseFileRepo },
      { therapistId }
    );
  } catch (err) {
    // خطاها فقط لاگ می‌شوند — بدونِ افشایِ متنِ بالینی (LAW-001). وضعیتِ رکورد در
    // client_case_file.status='error' می‌ماند (خودِ generateCaseFile این را ثبت می‌کند)؛
    // تراپیست هروقت وارد شد می‌تواند دستی دوباره تلاش کند.
    console.log('[case-file] auto-generate ناموفق برایِ client=' + clientId + ':', err instanceof Error ? err.message : String(err));
  }
}

// ⭐ پردازش صدا در background — با API واقعیِ async (stt-async-v5)، نه وانمودِ
// زنده‌بودن رویِ موتورِ realtime (که طبقِ docsِ Soniox دقتِ تشخیصِ گوینده‌ی پایین‌تری داره)
// ⭐ باگِ واقعیِ کشف‌شده (2026-09-18): برایِ جلسه‌ی دستی/آرشیو، auto-generate رویِ لحظه‌ی
// *ساختنِ* جلسه (که هنوز هیچ یادداشتی ندارد) اجرا می‌شد؛ یادداشتِ صوتی/متنی همیشه *بعد*ِ
// آن اضافه می‌شود (صفحه‌ی archiveNoteAdd) — یعنی پرونده تقریباً همیشه خالی/pending تولید
// می‌شد با اینکه تراپیست واقعاً محتوا ثبت کرده بود. فقط برایِ جلسه‌ی از‌قبل‌completedشده
// دوباره trigger می‌زنیم (جلسه‌ی زنده که یادداشتش قبل از completed ثبت می‌شود دست‌نخورده
// می‌ماند) — corpus_signature/قفلِ نرمِ موجود در generateCaseFile خودش از race/تکرارِ
// بی‌فایده جلوگیری می‌کند.
async function processVoiceNoteInBackground(
  sessionId: string,
  buffer: Buffer,
  autoTrigger: { clientId: string; therapistId: string; sessionWasCompleted: boolean }
) {
  try {
    const sonioxKey = process.env.SONIOX_API_KEY;
    if (!sonioxKey) return;

    const { transcribeFileAsync } = await import('../stt/asyncTranscribe.js');

    console.log('[voice-note] transcribing via async API, size:', buffer.length);
    const text = await transcribeFileAsync(buffer, `${sessionId}-note.webm`, `feelia:${sessionId}:note`);

    console.log('[voice-note] finished, text length:', (text || '').length);

    if (text && text.trim()) {
      await query(
        `INSERT INTO session_notes (id, session_id, type, text, wall_clock)
         VALUES (?, ?, 'voice', ?, ?)`,
        [randomUUID(), sessionId, text.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
      );
      console.log('[voice-note] ✓ saved to DB');
      if (autoTrigger.sessionWasCompleted) {
        void maybeAutoGenerateCaseFile(autoTrigger.clientId, autoTrigger.therapistId);
      }
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
  // mode='manual': ثبتِ دستیِ جلسه‌ی گذشته (آرشیوِ پرونده‌های قبلی) — هیچ ضبط/صدایی
  // در کار نیست، پس رضایتِ ضبط موضوعیت ندارد (LAW-009)؛ جلسه مستقیماً completed ساخته می‌شود.
  app.post('/api/sessions', async (request, reply) => {
    const { client_id, consent, date, start_time, mode, note } = request.body as {
      client_id: string;
      consent: boolean;
      date?: string;
      start_time?: string;
      mode?: string;
      note?: string;
    };

    if (mode !== undefined && mode !== 'live' && mode !== 'manual') {
      reply.code(400);
      return { error: 'نوعِ جلسه نامعتبر است' };
    }
    const isManual = mode === 'manual';

    if (!isManual && !consent) {
      reply.code(400);
      return { error: 'رضایت مراجع الزامی است' };
    }

    // ⭐ برایِ ثبتِ جلسه‌ی گذشته، تاریخ اختیاری‌ست (تصمیمِ مالک، 2026-09-15): تراپیست ممکنه
    // دقیقِ تاریخِ پرونده‌ی قدیمی رو نداشته باشه؛ اگه نفرسته، به‌جایِ fallbackِ نادرستِ «امروز»
    // (migration 014) به‌صراحت NULL ذخیره می‌شه — «بدونِ تاریخ». جلسه‌ی زنده همچنان همیشه
    // تاریخِ واقعی می‌گیرد (fallback به وقتِ ایران، رفتارِ قبلی دست‌نخورده). ساعت برایِ manual
    // در UI اصلاً نمایش داده نمی‌شود؛ سرور همیشه با fallbackِ وقتِ ایران پر می‌کند.
    const hasDate = typeof date === 'string' && date.trim() !== '';
    const hasTime = typeof start_time === 'string' && start_time.trim() !== '';
    // ⭐ همه‌ی تاریخ‌ها شمسیِ `YYYY/MM/DD` با ارقامِ لاتین (migration 013) — قبلاً جلسه‌ی زنده
    // تاریخِ میلادیِ سرور می‌گرفت و «آخرین جلسه» (`MAX(date)` روی TEXT) غلط می‌شد.
    const now = nowInTehran();
    let sessionDate: string | null = null;
    if (hasDate) {
      sessionDate = normalizeSessionDate(date);
      if (!sessionDate) {
        reply.code(400);
        return { error: INVALID_DATE_ERROR };
      }
    } else if (!isManual) {
      sessionDate = now.date;
    }
    // isManual && !hasDate → sessionDate می‌ماند null («بدونِ تاریخ»، تصمیمِ مالک)
    const sessionTime = hasTime ? normalizeStartTime(start_time) : now.time;
    if (!sessionTime) {
      reply.code(400);
      return { error: INVALID_TIME_ERROR };
    }

    const client = await getOwnedClient(client_id, request.therapistId!);
    if (!client) {
      reply.code(404);
      return { error: 'مراجع یافت نشد' };
    }

    // ⭐ مراجعِ غیرفعال جلسه‌ی زنده‌ی جدید نمی‌گیرد (کارت هم دکمه‌ی شروع ندارد). ادامه‌ی
    // جلسه‌ی نیمه‌تمامِ قبلی از این مسیر نمی‌گذرد و آزاد می‌ماند.
    if (!isManual && client.status === 'inactive') {
      reply.code(409);
      return { error: 'مراجع غیرفعال است؛ ابتدا او را به فعال‌ها بازگردانید', code: 'client-inactive' };
    }

    const lastNum = await query(
      'SELECT COALESCE(MAX(session_num), 0) + 1 as next FROM sessions WHERE client_id = ?',
      [client_id]
    );
    const sessionNum = lastNum.rows[0].next;

    if (isManual) {
      const noteText = typeof note === 'string' && note.trim() ? note.trim() : null;
      const sessionId = randomUUID();
      // یک تراکنشِ اتمیک: جلسه بدونِ یادداشتش (یا برعکس) نیمه‌کاره ساخته نمی‌شود.
      // (نسخه‌ی Postgres یک CTEِ نویسنده بود — MySQL از INSERT درونِ WITH پشتیبانی
      // نمی‌کند، پس همان اتمیک‌بودن با تراکنشِ صریح تأمین شده.)
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status, source)
           VALUES (?, ?, ?, ?, ?, false, 'completed', 'manual')`,
          [sessionId, client_id, sessionNum, sessionDate, sessionTime]
        );
        if (noteText !== null) {
          await conn.query(
            `INSERT INTO session_notes (id, session_id, type, text) VALUES (?, ?, 'note_after', ?)`,
            [randomUUID(), sessionId, noteText]
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      const manual = await query('SELECT * FROM sessions WHERE id = ?', [sessionId]);
      // ⭐ باگِ واقعیِ کشف‌شده (2026-09-18): trigger زدن اینجا بدونِ قیدِ noteText یک
      // raceِ واقعی می‌ساخت — اکثرِ جلساتِ دستی در همین لحظه هنوز هیچ یادداشتی ندارند
      // (یادداشت جداگانه بعداً با POST /notes اضافه می‌شود، صفحه‌ی archiveNoteAdd)؛
      // یک generateِ تقریباً-خالی همین‌جا شروع می‌شد و قفلِ نرمِ ۳دقیقه‌ای را می‌گرفت،
      // بعد trigger واقعیِ POST /notes (که محتوایِ واقعی دارد) با «busy» رد می‌شد و
      // بی‌صدا گم می‌شد. فقط وقتی trigger بزن که یادداشت همین‌جا، اتمیک، ثبت شده باشد؛
      // در غیرِ این صورت trigger روی POST /notes (پایینِ همین فایل) خودش کار را می‌کند.
      if (noteText !== null) {
        void maybeAutoGenerateCaseFile(client_id, request.therapistId!);
      }
      logEvent({ event: 'session.created', sessionId, clientId: client_id, therapistId: request.therapistId, detail: { mode: 'manual' } });
      reply.code(201);
      return {
        session: manual.rows[0],
        client: { code: client.code, alias: client.alias },
      };
    }

    const newId = randomUUID();
    await query(
      `INSERT INTO sessions (id, client_id, session_num, date, start_time, consent, status)
       VALUES (?, ?, ?, ?, ?, ?, 'in_progress')`,
      [newId, client_id, sessionNum, sessionDate, sessionTime, true]
    );
    const result = await query('SELECT * FROM sessions WHERE id = ?', [newId]);
    logEvent({ event: 'session.created', sessionId: newId, clientId: client_id, therapistId: request.therapistId, detail: { mode: 'live' } });

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
       WHERE s.id = ? AND c.therapist_id = ?`, [id, request.therapistId]
    );

    if (sessionResult.rows.length === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    // MySQL از NULLS LAST پشتیبانی نمی‌کند؛ `(offset_ms IS NULL)` در ASC صفر (غیرِnull)
    // را قبل از یک (null) می‌گذارد — همان اثرِ NULLS LAST.
    const notesResult = await query(
      'SELECT * FROM session_notes WHERE session_id = ? ORDER BY (offset_ms IS NULL), offset_ms, created_at',
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
      date?: string | null;
      start_time?: string;
    };

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    // R5 (subsystem 03 §2/§5): پیش‌بررسیِ زیر (SELECT جدا) به‌تنهایی CAS نیست — بینِ این
    // SELECT و UPDATEِ پایینِ تابع یک پنجره‌ی race باز بود: دو PUTِ هم‌زمان با همان نسخه‌ی
    // پایه می‌توانستند هر دو از این چک عبور کنند و هر دو UPDATE موفق شوند (یکی متنِ
    // دیگری را بی‌صدا overwrite می‌کرد). الان پیش‌بررسی فقط برایِ خطایِ سریع/واضح نگه
    // داشته شده؛ گاردِ واقعی همان `AND transcript_version = ?`ی اتمیکِ پایینِ همین تابع
    // است که مستقیماً در WHEREِ UPDATE می‌آید (پیشنهادِ همان سند، بخشِ ۵.۴).
    let versionGuard: number | undefined;
    if (body.transcript !== undefined) {
      // فیکسِ نشتِ حریمِ‌خصوصی (فازِ ۱ِ رصد/حسابرسی، 2026-09-22، LAW-001): این‌جا قبلاً
      // ۸۰ نویسه‌ی آخرِ متنِ بالینی را مستقیم در stdout لاگ می‌کرد (console.log
      // [diag-transcript]). جایگزین: فقط متادیتای امن (طول/نسخه) از طریقِ logEvent.
      logEvent({ event: 'session.transcript_put', sessionId: id, therapistId: request.therapistId, detail: { len: body.transcript.length, version: body.transcript_version } });
      // ✅ Compare-and-swap: اگر caller نسخه‌ی پایه بفرستد و با DB نخورد → 409، نه overwrite.
      // callerهای قدیمی (بدون transcript_version) همچنان پذیرفته‌اند (سازگاری عقبرو).
      if (typeof body.transcript_version === 'number') {
        const curV = await query('SELECT transcript_version FROM sessions WHERE id = ?', [id]);
        const cv: number = curV.rows[0]?.transcript_version ?? 0;
        if (cv !== body.transcript_version) {
          logEvent({ event: 'session.transcript_conflict', sessionId: id, therapistId: request.therapistId, severity: 'warn', detail: { version: body.transcript_version, prev_version: cv } });
          reply.code(409);
          return {
            error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید',
            code: 'version-conflict',
            current_version: cv,
          };
        }
        versionGuard = body.transcript_version;
      }
      updates.push(`transcript = ?`);
      values.push(body.transcript);
      // هر write موفق، نسخه را یکی جلو می‌برد — اتمیک در همین UPDATE
      updates.push(`transcript_version = transcript_version + 1`);
    }
    if (body.realtime_reliable !== undefined) {
      updates.push(`realtime_reliable = ?`);
      values.push(body.realtime_reliable);
    }
    if (body.stt_mode !== undefined) {
      updates.push(`stt_mode = ?`);
      values.push(body.stt_mode);
    }
    if (body.anchors !== undefined) {
      updates.push(`anchors = ?`);
      values.push(JSON.stringify(body.anchors));
    }
    if (body.duration_ms !== undefined) {
      updates.push(`duration_ms = ?`);
      values.push(body.duration_ms);
    }
    if (body.status !== undefined) {
      updates.push(`status = ?`);
      values.push(body.status);
    }
    if (body.date !== undefined) {
      const dateIsEmpty = body.date === null || (typeof body.date === 'string' && body.date.trim() === '');
      if (dateIsEmpty) {
        // ⭐ پاک‌کردنِ تاریخ فقط برایِ جلسه‌ی دستی معنا دارد («بدونِ تاریخ» — تصمیمِ مالک،
        // migration 014). جلسه‌ی زنده/کامل باید همیشه تاریخِ واقعی داشته باشد.
        if (owned.source !== 'manual') {
          reply.code(400);
          return { error: INVALID_DATE_ERROR };
        }
        updates.push(`date = NULL`);
      } else {
        const normalizedDate = normalizeSessionDate(body.date);
        if (!normalizedDate) {
          reply.code(400);
          return { error: INVALID_DATE_ERROR };
        }
        updates.push(`date = ?`);
        values.push(normalizedDate);
      }
    }
    if (body.start_time !== undefined) {
      const normalizedTime = normalizeStartTime(body.start_time);
      if (!normalizedTime) {
        reply.code(400);
        return { error: INVALID_TIME_ERROR };
      }
      updates.push(`start_time = ?`);
      values.push(normalizedTime);
    }

    if (updates.length === 0) {
      reply.code(400);
      return { error: 'چیزی برای به‌روزرسانی نیست' };
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);
    values.push(request.therapistId);
    // گاردِ اتمیکِ واقعی: اگه transcript_versionِ caller داده شده، همون شرط مستقیم توی
    // WHEREِ همین UPDATE می‌آید — نه یک SELECTِ جداگانه‌ی قبلی. دو PUTِ هم‌زمان با نسخه‌ی
    // یکسان دیگر نمی‌توانند هر دو موفق شوند: اولی رَویی که می‌رسد نسخه را +1 می‌کند،
    // دومی چون `transcript_version = ?`ِ قدیمی دیگر با ردیفِ به‌روزشده نمی‌خورَد rowCount=0
    // می‌گیرد (نه overwriteِ بی‌صدا).
    let sql = `UPDATE sessions SET ${updates.join(', ')}
       WHERE id = ? AND client_id IN (SELECT id FROM clients WHERE therapist_id = ?)`;
    if (versionGuard !== undefined) {
      sql += ` AND transcript_version = ?`;
      values.push(versionGuard);
    }
    const update = await query(sql, values);

    if (update.rowCount === 0) {
      if (versionGuard !== undefined) {
        // یا جلسه/مالکیت پیدا نشد، یا نسخه دقیقاً همین بینِ پیش‌بررسیِ بالا و همین UPDATE
        // توسطِ یک نویسنده‌ی هم‌زمانِ دیگر عوض شده — تشخیصِ صریح برایِ پیامِ درست:
        const recheck = await query(
          'SELECT transcript_version FROM sessions WHERE id = ? AND client_id IN (SELECT id FROM clients WHERE therapist_id = ?)',
          [id, request.therapistId]
        );
        if (recheck.rows.length === 0) {
          reply.code(404);
          return { error: 'جلسه یافت نشد' };
        }
        reply.code(409);
        return {
          error: 'نسخه‌ی transcript قدیمی است؛ ابتدا تازه‌سازی کنید',
          code: 'version-conflict',
          current_version: recheck.rows[0].transcript_version,
        };
      }
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const result = await query('SELECT * FROM sessions WHERE id = ?', [id]);
    if (body.status === 'completed') {
      // fire-and-forget — پایانِ کاملِ جلسه (زنده یا دستی) یکی از دو نقطه‌ی تریگرِ
      // auto-generate است؛ نقطه‌ی دیگر ساختِ جلسه‌ی دستی در بالاست.
      void maybeAutoGenerateCaseFile(owned.client_id, request.therapistId!);
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

    const del = await query(
      `DELETE FROM sessions
       WHERE id = ? AND client_id IN (SELECT id FROM clients WHERE therapist_id = ?)`,
      [id, request.therapistId]
    );

    if (del.rowCount === 0) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    // LAW-010: بعدِ حذفِ موفقِ ردیفِ DB، فایل‌هایِ آرشیوشده‌ی همین جلسه رویِ دیسک را هم پاک کن
    // (وگرنه یتیم می‌مانند — cascadeِ DB فقط ردیف را می‌بیند، نه فایل).
    deleteSessionAudioDirs([id]);
    logEvent({ event: 'session.deleted', sessionId: id, therapistId: request.therapistId });

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

    const noteId = randomUUID();
    await query(
      `INSERT INTO session_notes (id, session_id, type, text, sign_type, offset_ms, wall_clock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [noteId, id, type, text || null, sign_type || null, offset_ms || null, wall_clock || null]
    );
    const result = await query('SELECT * FROM session_notes WHERE id = ?', [noteId]);

    // یادداشتِ جلسه‌ی از‌قبل‌completedشده (مثلِ افزودنِ یادداشت به جلسه‌ی دستی/آرشیو بعدِ
    // ساختنش) — همان باگِ بالا: بدونِ این، auto-generate هیچ‌وقت این محتوا را نمی‌بیند.
    if (owned.status === 'completed') {
      void maybeAutoGenerateCaseFile(owned.client_id, request.therapistId!);
    }

    reply.code(201);
    return { note: result.rows[0] };
  });

  // DELETE /api/notes/:id — حذف یادداشت
  app.delete('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // MySQL از DELETE ... USING ... RETURNING پشتیبانی نمی‌کند؛ چکِ مالکیت با SELECT
    // جدا انجام می‌شود (race در این اپِ تک‌پروسه‌ای — LAW-013 — عملاً بی‌اثر است).
    const owned = await query(
      `SELECT n.id FROM session_notes n
       JOIN sessions s ON n.session_id = s.id
       JOIN clients c ON s.client_id = c.id
       WHERE n.id = ? AND c.therapist_id = ?`,
      [id, request.therapistId]
    );

    if (owned.rows.length === 0) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }

    await query('DELETE FROM session_notes WHERE id = ?', [id]);
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
    processVoiceNoteInBackground(id, buffer, {
      clientId: owned.client_id,
      therapistId: request.therapistId!,
      sessionWasCompleted: owned.status === 'completed',
    }).catch(() => {});

    reply.code(202);
    return {
      status: 'processing',
      message: 'صدا دریافت شد — در حال رونویسی',
    };
  });

  // ===== Batch fallback + آرشیوِ صدا =====
  // حریم خصوصی: صوت فقط وقتی به سرور می‌آید که realtime ناموفق/غیرقابل‌اعتماد باشد،
  // یا (purpose=archive) عمداً برایِ بازبینیِ ادمین نگه داشته بشه — نه به‌صورتِ پیش‌فرض.
  // ?purpose=transcript (پیش‌فرض) → merge در sessions.transcript
  // ?purpose=note → فقط session_notes(type='voice')، هرگز transcript (ISSUE 3)
  // ?purpose=archive → realtime موفق بود، متن دست‌نخورده می‌مونه، فقط صدا آرشیو می‌شه
  // ?purpose=late-transcript → صدایِ آفلاینی که *بعدِ* پایانِ جلسه رسیده (audit صدا/۲۰۲۶-۰۹-۱۶،
  //   تصمیمِ مالک) — رویِ جلسه‌ی completed هم مجاز است؛ رونویسی می‌شود و با برچسبِ صریح append.
  app.post('/api/sessions/:id/batch-audio', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as any;
    const purpose = (
      q?.purpose === 'note' ? 'note' : q?.purpose === 'archive' ? 'archive' :
      q?.purpose === 'late-transcript' ? 'late-transcript' : 'transcript'
    ) as import('../stt/batchqueue.js').BatchPurpose;
    // seq: ترتیبِ واقعیِ ضبطِ این سگمنت (از کلاینت) — برایِ اسمِ فایل و مرتب‌سازیِ درست،
    // چون آپلودها ممکنه به ترتیبِ رسیدن با ترتیبِ ضبط فرق کنن.
    const seqRaw = Number(q?.seq);
    const seq = Number.isFinite(seqRaw) && seqRaw >= 0 ? Math.floor(seqRaw) : 0;
    // run: شناسه‌ی یکتایِ RTSession (هر بارِ start/resume یکی می‌گیره) — بدونِ این، دو
    // run مختلف با seq یکسان (مثلاً یادداشتِ صوتی و جلسه، یا ادامه‌ی جلسه بعدِ رفرش)
    // در آرشیوِ سرور تصادم می‌کردن (رجوع به archiveAudioForAdmin/sessionAudioArchive.ts).
    const runRaw = typeof q?.run === 'string' ? q.run.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) : '';
    const runId = runRaw || 'legacy';

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    // ⭐ فیکسِ باگِ واقعی: آرشیو و یادداشتِ صوتی هیچ‌کدام transcript را دست نمی‌زنند،
    // پس رویِ جلسه‌ی completed هم باید مجاز باشند — مخصوصاً purpose=note، چون تنها
    // نقطه‌ی UI که یادداشتِ صوتی می‌سازد (دکمه‌ی «یادداشت صوتی» در Wrapup) همیشه
    // بعد از این اجرا می‌شود که endNewRTSession() همین‌جا status=completed فرستاده
    // (کامنتِ خودِ همان تابع: «finish() و PUT status=completed تقریباً هم‌زمان می‌رن»).
    // یعنی قبل از این فیکس، مسیرِ batch-pending-note برایِ صد-درصدِ یادداشت‌های
    // صوتی‌ای که realtime نداشتند با ۴۰۰ رد می‌شد — صدا ضبط می‌شد ولی هیچ‌وقت
    // آپلود/رونویسی نمی‌شد. purpose=transcript همچنان روی جلسه‌ی تمام‌شده مسدود
    // می‌ماند (نباید متنِ نهایی بعد از پایان تغییر کند).
    if (purpose === 'transcript' && (owned.status === 'completed' || owned.status === 'canceled')) {
      reply.code(400);
      return { error: 'جلسه پایان یافته است' };
    }
    // late-transcript روی completed مجاز است (دقیقاً همون دلیلِ وجودش)، ولی نه روی canceled —
    // جلسه‌ی لغوشده قرار نیست متنِ جدید بگیرد.
    if (purpose === 'late-transcript' && owned.status === 'canceled') {
      reply.code(400);
      return { error: 'جلسه لغو شده است' };
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
    // mimeِ واقعیِ ارسالی از مرورگر (audit صدا/۲۰۲۶-۰۹-۱۶، بخشِ E) — قبلاً همیشه
    // 'audio/webm' هاردکد می‌شد، حتی برایِ فایرفاکس/سافاری که ogg/mp4 می‌فرستند.
    const mime = typeof file.mimetype === 'string' && file.mimetype ? file.mimetype : 'audio/webm';

    const { baseVersion } = await enqueueBatch(id, buffer, purpose, seq, runId, mime);
    logEvent({ event: 'audio.segment_received', sessionId: id, therapistId: request.therapistId, detail: { bytes: buffer.length, seq, purpose } });
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
    const hasLateAudio = !!pendingAudioFor(id, 'late-transcript');
    return {
      batch_status: owned.batch_status ?? null,
      stt_mode: owned.stt_mode ?? null,
      realtime_reliable: owned.realtime_reliable ?? null,
      transcript_version: owned.transcript_version ?? 0,
      audio_pending: hasAudio,
      note_audio_pending: hasNoteAudio,
      late_transcript_pending: hasLateAudio,
    };
  });

  app.post('/api/sessions/:id/batch-retry', async (request, reply) => {
    const { id } = request.params as { id: string };
    const purposeRaw = (request.query as any)?.purpose;
    const purpose = (
      purposeRaw === 'note' ? 'note' : purposeRaw === 'late-transcript' ? 'late-transcript' : 'transcript'
    ) as import('../stt/batchqueue.js').BatchPurpose;
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

  // ===== بازسازیِ اختیاریِ شماره‌گذاریِ گوینده‌ها =====
  // فقط با کلیکِ صریحِ تراپیست (نه خودکار) — چون رونویسیِ دوباره چند دقیقه طول
  // می‌کشه و هزینه‌ی Soniox داره؛ خیلی از جلسات اصلاً نیازش نیست.
  // POST → کارِ پس‌زمینه رو شروع می‌کنه (idempotent — اگه از قبل در حالِ اجراست، همون رو برمی‌گردونه)
  app.post('/api/sessions/:id/resolve-speakers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    if (owned.status !== 'completed') {
      reply.code(400);
      return { error: 'فقط برایِ جلساتِ پایان‌یافته ممکن است' };
    }
    const audio = await listSessionAudio(id);
    if (!audio.length) {
      reply.code(400);
      return { error: 'صدایی برایِ این جلسه آرشیو نشده — این قابلیت در دسترس نیست' };
    }
    const job = startResolveSpeakers(id);
    reply.code(202);
    return { status: job.status };
  });

  // GET → وضعیتِ همون جاب (preview متن، بدونِ هیچ نوشتنی رویِ transcriptِ اصلی —
  // اعمالِ نهایی از همون PUT /api/sessions/:id با transcript_version انجام می‌شه)
  app.get('/api/sessions/:id/resolve-speakers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }
    const job = getResolveJob(id);
    if (!job) {
      reply.code(404);
      return { error: 'هنوز شروع نشده' };
    }
    return { status: job.status, text: job.text, error: job.error };
  });
}
