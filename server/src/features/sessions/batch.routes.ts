// صدایِ جلسه رویِ سرور: batch fallback + آرشیو، وضعیت/تلاشِ دوباره، و بازسازیِ اختیاریِ گوینده‌ها —
// pluginِ فرزندِ sessionRoutes (گاردِ requireAuth از آن به ارث می‌رسد).
import { FastifyInstance } from 'fastify';
import { getOwnedSession } from '../../db/ownership.js';
import {
  enqueueBatch,
  pendingAudioFor,
  processBatchQueue,
  validateAudioBuffer,
  type BatchPurpose,
} from '../transcription/batch/batchQueue.js';
import { getResolveJob, startResolveSpeakers } from '../transcription/speakerResolve.js';
import { listSessionAudio } from '../transcription/archive/sessionAudioArchive.js';
import { logEvent } from '../../obs/eventLog.js';

export async function sessionBatchRoutes(app: FastifyInstance) {
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
      q?.purpose === 'note-archive' ? 'note-archive' :
      q?.purpose === 'late-transcript' ? 'late-transcript' : 'transcript'
    ) as BatchPurpose;
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
    ) as BatchPurpose;
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
    // (A1.7) فقط صدایِ خودِ جلسه — یادداشتِ صوتی (kind='note') هرگز واردِ متنِ جلسه نمی‌شود (LAW-008).
    if (!audio.some((a) => a.kind === 'session')) {
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
