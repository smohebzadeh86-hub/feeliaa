// ابزارهایِ خالصِ متنِ جلسه برایِ «متنِ نهایی»: خواندنِ نوبت‌ها از قالبِ «گوینده N: …»، تکه‌بندی رویِ مرزِ نوبت،
// و ساختِ متنِ خروجی. بدونِ I/O تا هارنس (scripts/final-transcript-harness.ts) بدونِ DB/شبکه تستش کند.
//
// قالبِ ورودی همان قراردادِ realtime (soniox.ts) و async (buildTextFromAsyncTokens) است: بلوک‌ها با خطِ خالی جدا
// می‌شوند، هر نوبت با «گوینده N: » شروع می‌شود و نشانگرِ علامت ([علامت · ۰۱:۲۳ — …]) بلوکِ جداست.

export interface Turn {
  // شماره‌ی گوینده همان‌طور که در متن آمده (ارقامِ فارسی)؛ null = بلوکِ بدونِ برچسب (ادامه یا متنِ آزاد)
  speaker: string | null;
  text: string;
  // نشانگرِ علامت: دقیقاً همان رشته باید در خروجی بماند
  marker?: boolean;
}

const SPEAKER_RE = /^گوینده\s+([0-9۰-۹]+)\s*:\s*/;
// باید دقیقاً برابرِ audio-upload/jobRunner.UPLOAD_TRANSCRIPT_LABEL_PREFIX باشد (harnessِ test:ft برابری را چک می‌کند).
// برچسبِ بخشِ آپلودیِ الحاق‌شده به متنِ جلسه با یک «\n» (نه خطِ خالی) به نوبتِ بعد چسبیده است؛ بدونِ جداکردنش،
// نوبتِ اولِ بخشِ آپلودی برچسبِ گوینده‌اش را از دست می‌داد و خودِ برچسب به دستِ LLM می‌افتاد.
export const UPLOAD_LABEL = '[متنِ فایلِ صوتیِ آپلودشده]';
const MARKER_RE = /^(\[علامت · [^\]]*\]|\[متنِ فایلِ صوتیِ آپلودشده\])$/;
const PIECE_SPLIT_RE = /(\[علامت · [^\]]*\]|\[متنِ فایلِ صوتیِ آپلودشده\])/;
export const SIGN_MARKER_GLOBAL_RE = /\[علامت · [^\]]*\]/g;

export function parseTurns(raw: string): Turn[] {
  const out: Turn[] = [];
  for (const block of String(raw || '').replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b) continue;
    // نشانگرِ علامت (یا برچسبِ بخشِ آپلودی) ممکن است بدونِ خطِ خالی کنارِ متن آمده باشد — جدا می‌شود تا دست‌نخورده بماند.
    const pieces = b.split(PIECE_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
    for (const p of pieces) {
      if (MARKER_RE.test(p)) { out.push({ speaker: null, text: p, marker: true }); continue; }
      const m = SPEAKER_RE.exec(p);
      if (m) out.push({ speaker: toFaDigits(m[1]), text: p.slice(m[0].length).trim() });
      else out.push({ speaker: null, text: p });
    }
  }
  return out;
}

export function toFaDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

function toLatin(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function maxSpeakerNumber(text: string): number {
  let max = 0;
  for (const m of String(text || '').matchAll(/(?:^|\n)\s*گوینده\s+([0-9۰-۹]+)\s*:/g)) max = Math.max(max, Number(toLatin(m[1])) || 0);
  return max;
}

// ورودیِ «متنِ نهایی» وقتی متنِ فایلِ آپلودی به متنِ موجودِ جلسه الحاق شده: کلِ متن، با برچسبِ جداکننده (نشانگرِ
// دست‌نخورده) و شماره‌ی گوینده‌هایِ بخشِ آپلودی بعد از بزرگ‌ترین شماره‌ی بخشِ قبلی — دو diarizationِ مستقل‌اند و
// «گوینده ۱» ِ این دو لزوماً یک نفر نیست؛ برداشتِ کلیِ LLM هر شماره را جدا به نقش نگاشت می‌کند.
export function appendUploadForPolish(existing: string, label: string, uploadText: string): string {
  const offset = maxSpeakerNumber(existing);
  const shifted = offset
    ? uploadText.replace(/(^|\n)(\s*)گوینده\s+([0-9۰-۹]+)(\s*:)/g, (_m, a, sp, n, colon) => `${a}${sp}گوینده ${toFaDigits(String((Number(toLatin(n)) || 0) + offset))}${colon}`)
    : uploadText;
  return existing.trim() + '\n\n' + label + '\n\n' + shifted.trim();
}

export function turnsToRawText(turns: Turn[]): string {
  return turns.map((t) => (t.marker || !t.speaker ? t.text : `گوینده ${t.speaker}: ${t.text}`)).join('\n\n');
}

// نوبتِ خیلی بلند (مثلاً یک گوینده‌ی ۲۰دقیقه‌ای) رویِ مرزِ جمله شکسته می‌شود تا هیچ تکه‌ای از سقف رد نشود.
function splitLongTurn(t: Turn, maxChars: number): Turn[] {
  if (t.marker || t.text.length <= maxChars) return [t];
  const sentences = t.text.split(/(?<=[.!؟?…])\s+/);
  const parts: Turn[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && cur.length + s.length + 1 > maxChars) { parts.push({ speaker: t.speaker, text: cur }); cur = ''; }
    // جمله‌ی بی‌نقطه‌ی بلندتر از سقف: رویِ فاصله شکسته می‌شود
    let rest = s;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(' ', maxChars) > maxChars / 2 ? rest.lastIndexOf(' ', maxChars) : maxChars;
      if (cur) { parts.push({ speaker: t.speaker, text: cur }); cur = ''; }
      parts.push({ speaker: t.speaker, text: rest.slice(0, cut).trim() });
      rest = rest.slice(cut).trim();
    }
    cur = cur ? cur + ' ' + rest : rest;
  }
  if (cur) parts.push({ speaker: t.speaker, text: cur });
  return parts;
}

// تکه‌بندی رویِ مرزِ نوبت: هر تکه حداکثر maxChars نویسه (به‌جز نشانگر). نوبت هرگز بینِ دو تکه نصف نمی‌شود،
// مگر خودش از سقف بلندتر باشد.
export function chunkTurns(turns: Turn[], maxChars: number): Turn[][] {
  const chunks: Turn[][] = [];
  let cur: Turn[] = [];
  let len = 0;
  for (const t0 of turns) {
    for (const t of splitLongTurn(t0, maxChars)) {
      const l = t.text.length + 16;
      if (cur.length && len + l > maxChars) { chunks.push(cur); cur = []; len = 0; }
      cur.push(t);
      len += l;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// متنِ نهایی: «نقش: متن»، نشانگرها دست‌نخورده در جایِ خودشان.
// raw: متنِ خامِ نوبت‌هایِ سازنده (برایِ نمایشِ ویرایش‌ها در UI)؛ sp: شماره‌ی گوینده‌ی Soniox (برایِ «اصلاحِ نقش برایِ همه‌ی
// نوبت‌هایِ همین گوینده»). هر دو اختیاری‌اند و در clean_text نمی‌آیند.
export interface CleanTurn { role: string; text: string; marker?: boolean; raw?: string; sp?: string | null; }
export function renderClean(turns: CleanTurn[]): string {
  const out: string[] = [];
  for (const t of turns) {
    if (t.marker) { out.push(t.text); continue; }
    const text = t.text.trim();
    if (!text) continue;
    // نوبت‌هایِ پشتِ‌سرِ‌همِ یک نقش یکی می‌شوند (نتیجه‌ی reconnectهایِ realtime)
    const prev = out.length ? out[out.length - 1] : null;
    const prefix = `${t.role}: `;
    if (prev && prev.startsWith(prefix) && !MARKER_RE.test(prev)) out[out.length - 1] = prev + ' ' + text;
    else out.push(prefix + text);
  }
  return out.join('\n\n');
}

// برایِ گذرِ «برداشتِ کلی» رویِ متنِ خیلی بلند: ابتدا، میانه و انتها (هر کدام یک‌سوم از سقف).
export function sampleForOverview(raw: string, maxChars: number): string {
  if (raw.length <= maxChars) return raw;
  const part = Math.floor(maxChars / 3);
  const mid = Math.floor(raw.length / 2 - part / 2);
  return raw.slice(0, part) + '\n\n[…]\n\n' + raw.slice(mid, mid + part) + '\n\n[…]\n\n' + raw.slice(raw.length - part);
}
