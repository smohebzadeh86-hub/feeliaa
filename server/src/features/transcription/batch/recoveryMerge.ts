// ادغامِ متنِ بازیابی‌شده‌ی یک سگمنت در متنِ جلسه (تابعِ خالص) — placeholderِ «⏳» درجا پر می‌شود، وگرنه append با
// برچسب/کلید (LAW-008).
// ⭐ (A2) placeholderِ بازه‌ی قطعی که کلاینت در جایِ زمانیِ درست گذاشته (insertRecoveryPlaceholder در feelia-rt.js):
// «[⏳ … · #<run>:<seq>]». applyBatchSegmentOnce همان را درجا با متنِ بازیابی‌شده جایگزین می‌کند.
export const RECOVERED_LABEL = 'بازیابی‌شده از صدایِ بازه‌ی قطعی';
export const RECOVERED_EMPTY_LABEL = 'بازه‌ی قطعی — گفتاری تشخیص داده نشد';
export function recoveryKey(runId: string, seq: number): string {
  return `${String(runId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}:${seq}`;
}
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function recoveryPlaceholderRe(key: string): RegExp {
  return new RegExp(`\\[⏳ [^\\]\\n]*· #${escapeRe(key)}\\]`);
}
// ⭐ (2026-10-03، core-data-plan قدمِ ۵ — T59) سگمنتی که در لحظه‌ی تشخیصِ قطع بسته می‌شود از وسطِ گفتارِ زنده شروع شده: ابتدایش
// را Soniox زنده نوشته و فقط دُمش (بعد از آخرین توکنِ final) گم شده بود. متنِ بازیابی‌شده‌اش با همان واژه‌ها شروع می‌شود ⇒ پیشوندی از
// آن که دقیقاً دُمِ متنِ پیش از placeholder است حذف می‌شود. محافظه‌کار: فقط واژه‌ها (بدونِ برچسبِ «گوینده N:» و علائم)، دست‌کم
// OVERLAP_MIN_WORDS واژه و ≥ OVERLAP_MATCH جایگاهِ برابر؛ وگرنه هیچ چیز حذف نمی‌شود (تکرارِ برچسب‌دار بهتر از گم‌شدن، LAW-008).
export const OVERLAP_MIN_WORDS = 4;
const OVERLAP_MATCH = 0.85;
const OVERLAP_MAX_WORDS = 200;
const SPEAKER_LABEL_RE = /گوینده\s+[0-9۰-۹]+\s*:/g;
function normWord(w: string): string {
  return w.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ْٰ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}
function wordsWithPos(s: string): Array<{ w: string; start: number }> {
  const masked = s.replace(SPEAKER_LABEL_RE, (m) => ' '.repeat(m.length)).replace(/\[[^\]\n]*\]/g, (m) => ' '.repeat(m.length));
  const out: Array<{ w: string; start: number }> = [];
  for (const m of masked.matchAll(/[^\s‌]+/g)) {
    const w = normWord(m[0]);
    if (w) out.push({ w, start: m.index! });
  }
  return out;
}
export function trimOverlapWithPreceding(preceding: string, recovered: string): { text: string; trimmedWords: number } {
  const prev = wordsWithPos(preceding).slice(-OVERLAP_MAX_WORDS).map((x) => x.w);
  const rec = wordsWithPos(recovered);
  const maxK = Math.min(prev.length, rec.length, OVERLAP_MAX_WORDS);
  for (let k = maxK; k >= OVERLAP_MIN_WORDS; k--) {
    let same = 0;
    for (let i = 0; i < k; i++) if (rec[i].w === prev[prev.length - k + i]) same++;
    // اولین و آخرین واژه‌ی هم‌پوشانی باید دقیقاً برابر باشند (لنگرِ دو سر)، و کل ≥ OVERLAP_MATCH
    if (same / k >= OVERLAP_MATCH && rec[0].w === prev[prev.length - k] && rec[k - 1].w === prev[prev.length - 1]) {
      const cut = k < rec.length ? rec[k].start : recovered.length;
      // برچسبِ گوینده‌ای که درست پیش از واژه‌ی بعدی است باید بماند ⇒ برش از ابتدایِ همان خط/برچسب
      const before = recovered.slice(0, cut);
      const labelAt = before.search(/گوینده\s+[0-9۰-۹]+\s*:\s*$/);
      const at = labelAt >= 0 ? labelAt : cut;
      return { text: recovered.slice(at).replace(/^\s+/, ''), trimmedWords: k };
    }
  }
  return { text: recovered, trimmedWords: 0 };
}

export const RECOVERED_DUP_LABEL = 'بازه‌ی قطعی — گفتارِ این بخش پیش‌تر در متن ثبت شده بود';

// متنِ فعلی + متنِ بازیابی‌شده‌ی یک سگمنت ⇒ متنِ جدید (یا null اگر تغییری لازم نیست).
export function mergeRecoveredSegment(currentText: string, text: string, key: string | undefined, label?: string): string | null {
  const re = key ? recoveryPlaceholderRe(key) : null;
  const m = re ? re.exec(currentText) : null;
  if (re && m) {
    let body = text;
    let dup = false;
    if (text) {
      const t = trimOverlapWithPreceding(currentText.slice(0, m.index), text);
      body = t.text;
      dup = t.trimmedWords > 0 && !body.trim();
    }
    const repl = body ? `[${RECOVERED_LABEL} · #${key}]\n${body}` : `[${dup ? RECOVERED_DUP_LABEL : RECOVERED_EMPTY_LABEL} · #${key}]`;
    return currentText.replace(re, () => repl);
  }
  if (!text) return null;
  // placeholder نیست (کلاینتِ قدیمی، یا placeholder هنوز ذخیره نشده بود) ⇒ رفتارِ قبلی: append، حالا با برچسب/کلید
  // تا کلاینت placeholderِ ذخیره‌نشده‌ی همان بازه را بعداً حذف کند (dropResolvedPlaceholders).
  const head = label ? label + (key ? ` [#${key}]` : '') : key ? `[${RECOVERED_LABEL} · #${key}]` : '';
  const segment = head ? `${head}\n${text}` : text;
  return currentText ? currentText + '\n\n' + segment : segment;
}

// ⭐ (2026-10-02، فاز ۶ ممیزیِ Core) بازه‌ای که هرگز رونویسی نمی‌شود (فایلِ نامعتبر/drop یا پاک‌سازیِ ۲۴ساعتهٔ صف) نباید «⏳ در حالِ
// بازیابی» برایِ همیشه در متن بماند: placeholder با نشانگرِ صادقانه جایگزین می‌شود (کلیدِ همان بازه حفظ است تا کلاینت
// بازه را «حل‌شده» ببیند). صدایِ همان بازه در آرشیوِ ادمین می‌ماند. placeholder نبود ⇒ null (چیزی عوض نمی‌شود).
export const RECOVERY_LOST_LABEL = 'بازه‌ی قطعی — متنِ این بخش بازیابی نشد (صدا در آرشیو است)';
export function mergeRecoveryLost(currentText: string, key: string | undefined): string | null {
  if (!key) return null;
  const re = recoveryPlaceholderRe(key);
  if (!re.test(currentText)) return null;
  return currentText.replace(re, () => `[${RECOVERY_LOST_LABEL} · #${key}]`);
}
