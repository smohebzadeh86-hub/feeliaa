// POST /api/sessions/:id/voice-note — مسیرِ LEGACY (LAW-015: فقط bugfix). محتوا بدونِ تغییر از sessions.routes جابه‌جا
// شده؛ pluginِ فرزندِ sessionRoutes (گاردِ requireAuth از آن به ارث می‌رسد).
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { query } from '../../db/connection.js';
import { getOwnedSession } from '../../db/ownership.js';
import { maybeAutoGenerateCaseFile } from '../case-file/application/autoTrigger.js';
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

    const { transcribeFileAsync } = await import('../transcription/soniox/restClient.js');

    console.log('[voice-note] transcribing via async API, size:', buffer.length);
    const text = await transcribeFileAsync(buffer, `${sessionId}-note.webm`, `feelia:${sessionId}:note`, { sessionContext: false });

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

export async function sessionVoiceNoteRoutes(app: FastifyInstance) {
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
}
