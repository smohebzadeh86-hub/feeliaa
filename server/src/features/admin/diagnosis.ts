// «چه اتفاقی افتاد؟» — تشخیصِ یک جلسه از داده‌یِ موجود (ردیفِ جلسه، صدایِ kind='session'، صفِ پردازش، رویدادهایِ
// obs و UI). تابعِ خالص: بدونِ DB/فایل. متنِ بالینی برگردانده نمی‌شود — فقط شمارش/طول (LAW-001).
import type { SessionAudioRow } from '../transcription/index.js';

export interface DiagnosisInput {
  s: any;
  audioRows: SessionAudioRow[];
  pendingCount: number;
  ev: any[];
  ui: any[];
  uploadJobs?: any[];
  finalTranscript?: any | null;
}

const TZ = 'Asia/Tehran';
const fmtAt = (v: unknown) => (v ? new Date(v as any).toLocaleString('fa-IR', { timeZone: TZ }) : '—');
const fmtLen = (ms: number) => {
  const t = Math.round(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h} ساعت و ${m} دقیقه` : m ? `${m} دقیقه و ${s} ثانیه` : `${s} ثانیه`;
};
const minsBetween = (a: unknown, b: unknown) => Math.max(0, Math.round((new Date(b as any).getTime() - new Date(a as any).getTime()) / 60000));
const JOB_STAGE_FA: Record<string, string> = { queued: 'در صف', normalizing: 'آماده‌سازیِ فایل', transcribing: 'رونویسی', case_file: 'ساختِ پرونده' };
const FT_STAGE_FA: Record<string, string> = { waiting_audio: 'منتظرِ صدا', transcribing: 'رونویسیِ دوباره', polishing: 'مرتب‌سازی' };

export function diagnoseSession({ s, audioRows, pendingCount, ev, ui, uploadJobs = [], finalTranscript = null }: DiagnosisInput) {
  const audioMs = audioRows.reduce((a, r) => a + (Number(r.duration_ms) || 0), 0);
  const audioBytes = audioRows.reduce((a, r) => a + (Number(r.bytes) || 0), 0);
  const kbps = audioMs > 0 ? Math.round((audioBytes * 8) / audioMs * 10) / 10 : null;
  const seqs = audioRows.map((r) => r.seq);
  const missing: number[] = [];
  if (seqs.length) for (let i = 0; i <= Math.max(...seqs); i++) if (!seqs.includes(i)) missing.push(i);

  const countEv = (name: string, pred?: (d: any) => boolean) => ev.filter((e) => e.event === name && (!pred || pred(e.detail || {}))).length;
  const wsDrops = countEv('rt.ws_close', (d) => d.close_code !== 1000 && d.close_code !== 1005);
  const reconnectOk = countEv('rt.reconnect_ok');
  const exhausted = countEv('rt.reconnect_exhausted');
  const mintFailed = countEv('rt.mint_failed');
  const micLost = countEv('rt.mic_lost');
  const batchFailed = countEv('batch.failed') + countEv('batch.segment_unrecoverable');
  const unreadable = countEv('audio.segment_unreadable');
  const quality = [...new Set(ev.filter((e) => e.event === 'rt.audio_quality_warn').map((e) => (e.detail || {}).reason).filter(Boolean))];

  const endClick = ui.find((u) => u.kind === 'click' && u.target_id === 'btnEndSession');
  const completedAt = ev.find((e) => e.event === 'rt.state_change' && (e.detail || {}).state === 'COMPLETED')?.ts || null;
  let hiddenCount = 0, hiddenMs = 0, hiddenAt: number | null = null;
  const stopAt = endClick ? new Date(endClick.ts).getTime() : Infinity;
  for (const u of ui) {
    if (u.kind !== 'visibility') continue;
    const t = new Date(u.ts).getTime();
    if (t > stopAt) break;
    if (u.target_id === 'hidden' && hiddenAt === null) { hiddenAt = t; hiddenCount++; }
    else if (u.target_id === 'visible' && hiddenAt !== null) { hiddenMs += t - hiddenAt; hiddenAt = null; }
  }

  const text: string = s.transcript || '';
  const paras = text.split(/\n\n+/).filter(Boolean);
  const shortParas = paras.filter((p) => p.replace(/^گوینده [۰-۹0-9]+:\s*/, '').trim().split(/\s+/).filter(Boolean).length <= 3).length;
  const durMs = Number(s.duration_ms) || 0;

  type F = { level: 'ok' | 'warn' | 'error'; text: string };
  const findings: F[] = [];
  const sec = (ms: number) => Math.round(ms / 1000);
  if (s.source === 'live') {
    if (s.status === 'in_progress' || s.status === 'recovered') findings.push({ level: 'warn', text: 'جلسه «پایان» نخورده است؛ داده تا آخرین ذخیره موجود است.' });
    if (endClick) findings.push({ level: 'ok', text: `دکمه‌ی «پایان جلسه» زده شد (ساعتِ ${new Date(endClick.ts).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' })}).` });
    if (!audioRows.length) findings.push({ level: 'error', text: 'هیچ صدایی برایِ این جلسه به سرور نرسیده است.' });
    else {
      if (durMs > 0 && audioMs < durMs * 0.9) findings.push({ level: 'error', text: `صدایِ رسیده (${sec(audioMs)}ث) کمتر از مدتِ جلسه (${sec(durMs)}ث) است — ${sec(durMs - audioMs)} ثانیه صدا نرسیده.` });
      else findings.push({ level: 'ok', text: `صدایِ کاملِ جلسه رسیده است (${sec(audioMs)}ث در ${audioRows.length} تکه).` });
      if (kbps !== null && audioMs > 20000 && kbps < 6) findings.push({ level: 'error', text: `صدا عملاً سکوت است (${kbps} kbps؛ جلساتِ سالم ۱۱–۲۵). میکروفون صدایی نگرفته — میکروفونِ اشتباه/بی‌صدا یا اشغال توسطِ برنامه‌ی دیگر.` });
      if (missing.length) findings.push({ level: 'error', text: `${missing.length} تکه از صدا هرگز به سرور نرسید (شماره‌ها: ${missing.join('، ')}).` });
    }
    if (unreadable) findings.push({ level: 'warn', text: 'بعضی تکه‌هایِ صدا خراب‌اند و از فایلِ کامل کنار گذاشته شدند.' });
    if (pendingCount) findings.push({ level: 'warn', text: `${pendingCount} فایلِ صدا هنوز در صفِ پردازشِ سرور است.` });
    if (micLost) findings.push({ level: 'error', text: `میکروفون ${micLost} بار حینِ ضبط قطع شد.` });
    for (const q of quality) {
      const m: Record<string, string> = { no_signal: 'میکروفون صدایی نمی‌گرفت', too_quiet: 'صدا خیلی ضعیف بود (دور از میکروفون)', noisy: 'نویزِ محیط غالب بود', clipping: 'صدا خش داشت (خیلی بلند)' };
      findings.push({ level: 'warn', text: 'هشدارِ کیفیتِ ضبط: ' + (m[q] || q) });
    }
    if (hiddenCount) findings.push({ level: 'warn', text: `صفحه ${hiddenCount} بار حینِ جلسه پنهان شد (جمعاً ${sec(hiddenMs)}ث) — رویِ موبایل می‌تواند رونویسی را قطع کند.` });
    if (wsDrops) findings.push({ level: 'warn', text: `اتصالِ رونویسیِ زنده ${wsDrops} بار قطع شد؛ ${reconnectOk} بار دوباره وصل شد.` });
    if (exhausted || mintFailed) findings.push({ level: 'error', text: `رونویسیِ زنده مدتی کاملاً در دسترس نبود (${exhausted + mintFailed} رویداد)؛ متنِ آن بازه از صدا بازیابی می‌شود.` });
    if (batchFailed || s.batch_status === 'failed') findings.push({ level: 'error', text: 'رونویسیِ صدایِ دوره‌ی قطعی ناموفق بود.' });
    if (audioMs > 60000 && text.length / (audioMs / 1000) < 2) findings.push({ level: 'error', text: `متن نسبت به طولِ صدا خیلی کم است (${text.length} نویسه برایِ ${sec(audioMs)}ث).` });
    if (paras.length >= 10 && shortParas / paras.length > 0.4) findings.push({ level: 'warn', text: `متن ${paras.length} بندِ گوینده دارد که ${shortParas} تایش ≤۳ کلمه است — تفکیکِ گوینده متن را تکه‌تکه نشان می‌دهد (داده گم نشده).` });
  } else if (s.source === 'upload') {
    // (2026-09-29، گزارشِ مالک) قبلاً برایِ جلسه‌ی آپلودی هیچ یافته‌ای نبود ⇒ کارت پنهان می‌ماند و ادمین نمی‌دید
    // فایل کِی آمد و پردازش کِی تمام شد. منبع: audio_jobs/audio_uploads (پایدار؛ obs_events جارو می‌شود).
    if (!uploadJobs.length) findings.push({ level: 'error', text: 'برایِ این جلسه‌ی آپلودی هیچ کارِ پردازشی ثبت نشده است.' });
    for (const j of uploadJobs) {
      const mb = j.size_bytes ? ` · ${Math.round(Number(j.size_bytes) / 1048576 * 10) / 10}MB` : '';
      findings.push({ level: 'ok', text: `فایل آپلود شد: شروع ${fmtAt(j.upload_started_at)}، پایان ${fmtAt(j.upload_completed_at || j.created_at)}${mb}.` });
      if (Number(j.duration_ms) > 0) findings.push({ level: 'ok', text: `مدتِ فایلِ صوتی: ${fmtLen(Number(j.duration_ms))}.` });
      const doneAt = j.transcript_applied_at || j.finished_at;
      if (j.stage === 'failed') findings.push({ level: 'error', text: `پردازشِ فایل ناموفق شد (${fmtAt(j.finished_at || j.created_at)}${j.error_code ? '، کد: ' + j.error_code : ''}).` });
      else if (j.transcript_applied_at) {
        findings.push({ level: 'ok', text: `رونویسی ذخیره شد: ${fmtAt(j.transcript_applied_at)} (${minsBetween(j.created_at, j.transcript_applied_at) || 'کمتر از ۱'} دقیقه پس از پایانِ آپلود).` });
        if (Number(j.transcript_chars) === 0) findings.push({ level: 'warn', text: 'در فایل گفتاری تشخیص داده نشد — متنی ذخیره نشد.' });
      } else if (!doneAt) findings.push({ level: 'warn', text: `فایل هنوز در حالِ پردازش است (مرحله: ${JOB_STAGE_FA[j.stage] || j.stage}، تلاشِ ${j.attempts || 0}).` });
      if (j.quality_warning) findings.push({ level: 'warn', text: `هشدارِ کیفیتِ فایل: بخشی از متن کم‌اطمینان است (${j.quality_warning}).` });
    }
  }
  // «متنِ نهایی» (هر نوع جلسه، اگر برایش صف شده باشد).
  if (finalTranscript) {
    const ft = finalTranscript;
    if (ft.stage === 'done') findings.push({ level: 'ok', text: `متنِ نهایی آماده شد: ${fmtAt(ft.finished_at)}.` });
    else if (ft.stage === 'failed') findings.push({ level: 'warn', text: `ساختِ متنِ نهایی ناموفق بود (${fmtAt(ft.finished_at)}${ft.error_code ? '، کد: ' + ft.error_code : ''}) — متنِ اصلی دست‌نخورده است.` });
    else if (ft.stage !== 'skipped') findings.push({ level: 'warn', text: `متنِ نهایی در حالِ ساخت است (مرحله: ${FT_STAGE_FA[ft.stage] || ft.stage}، از ${fmtAt(ft.queued_at)}).` });
  }
  return {
    diagnosis: {
      status: s.status, duration_ms: durMs, audio_ms: audioMs, audio_segments: audioRows.length, audio_kbps: kbps,
      missing_segments: missing, pending_count: pendingCount, ws_drops: wsDrops, reconnect_ok: reconnectOk,
      reconnect_exhausted: exhausted, mint_failed: mintFailed, mic_lost: micLost, quality_warnings: quality,
      hidden_count: hiddenCount, hidden_ms: hiddenMs, end_clicked_at: endClick ? endClick.ts : null, completed_at: completedAt,
      transcript_chars: text.length, speaker_paragraphs: paras.length, short_paragraphs: shortParas,
      updated_at: s.updated_at, created_at: s.created_at,
      upload_jobs: uploadJobs.map((j) => ({ stage: j.stage, duration_ms: j.duration_ms, error_code: j.error_code, upload_started_at: j.upload_started_at,
        upload_completed_at: j.upload_completed_at, transcript_applied_at: j.transcript_applied_at, finished_at: j.finished_at })),
      final_transcript: finalTranscript ? { stage: finalTranscript.stage, error_code: finalTranscript.error_code, finished_at: finalTranscript.finished_at } : null,
    },
    findings,
  };
}
