// «چه اتفاقی افتاد؟» — تشخیصِ یک جلسه از داده‌یِ موجود (ردیفِ جلسه، صدایِ kind='session'، صفِ پردازش، رویدادهایِ
// obs و UI). تابعِ خالص: بدونِ DB/فایل. متنِ بالینی برگردانده نمی‌شود — فقط شمارش/طول (LAW-001).
import type { SessionAudioRow } from '../transcription/index.js';

export interface DiagnosisInput {
  s: any;
  audioRows: SessionAudioRow[];
  pendingCount: number;
  ev: any[];
  ui: any[];
}

export function diagnoseSession({ s, audioRows, pendingCount, ev, ui }: DiagnosisInput) {
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
  }
  return {
    diagnosis: {
      status: s.status, duration_ms: durMs, audio_ms: audioMs, audio_segments: audioRows.length, audio_kbps: kbps,
      missing_segments: missing, pending_count: pendingCount, ws_drops: wsDrops, reconnect_ok: reconnectOk,
      reconnect_exhausted: exhausted, mint_failed: mintFailed, mic_lost: micLost, quality_warnings: quality,
      hidden_count: hiddenCount, hidden_ms: hiddenMs, end_clicked_at: endClick ? endClick.ts : null, completed_at: completedAt,
      transcript_chars: text.length, speaker_paragraphs: paras.length, short_paragraphs: shortParas,
      updated_at: s.updated_at,
    },
    findings,
  };
}
