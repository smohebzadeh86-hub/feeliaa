// نگهبان‌هایِ قطعی (بدونِ LLM) رویِ خروجیِ هر تکه‌ی مرتب‌شده. اگر یکی رد شود، همان تکه با متنِ خام جایگزین
// می‌شود (نه شکستِ کلِ کار). هدف: LLM حق ندارد معنا را عوض کند — منفی، عدد و نشانگرِ علامت باید دقیقاً بمانند،
// و متن نباید خلاصه یا بلندتر شود.

export interface GuardLimits {
  minLengthRatio: number;   // پیش‌فرض ۰٫۶۵
  maxLengthRatio: number;   // پیش‌فرض ۱٫۱۵
  minOverlap: number;       // پیش‌فرض ۰٫۷ — سهمِ واژه‌هایِ خام که در خروجی هم هستند
}
export const DEFAULT_GUARD_LIMITS: GuardLimits = { minLengthRatio: 0.65, maxLengthRatio: 1.15, minOverlap: 0.7 };

export type GuardFailure = 'length' | 'negation' | 'number' | 'marker' | 'overlap' | 'empty' | 'uncertain';

const FA_DIGIT: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
// علامتِ نامطمئنِ خروجیِ LLM (⟦…؟⟧) و نشانگرِ علامت در مقایسه‌ی واژه‌ها شمرده نمی‌شوند
const UNCERTAIN_RE = /⟦([^⟧]*)⟧/g;
const MARKER_RE = /\[علامت · [^\]]*\]/g;
const FILLERS = new Set(['اِ', 'ا', 'اه', 'اِم', 'ام', 'اوم', 'امم', 'هوم', 'اِه', 'ممم', 'مم']);

export function normalizeFa(s: string): string {
  return s
    .replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[ۀ]/g, 'ه')
    .replace(/[ً-ٰٟ]/g, '')           // اعراب (کسره‌ی اضافه و…)
    .replace(/[۰-۹٠-٩]/g, (d) => FA_DIGIT[d])
    .replace(/‌/g, ' ')                          // نیم‌فاصله ⇒ فاصله (هر دو طرف یکسان)
    .replace(/[«»"'“”،,.؛;:!?؟…()\-–—\[\]⟦⟧]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function words(s: string): string[] {
  const n = normalizeFa(s.replace(MARKER_RE, ' ').replace(UNCERTAIN_RE, '$1'));
  return n ? n.split(' ').filter((w) => !FILLERS.has(w)) : [];
}

// تکرارِ بی‌معنایِ پشتِ‌سرِ‌هم («من من»، «نه نه») حذف‌شدنی است — پس شمارشِ منفی/عدد رویِ نسخه‌ی بدونِ تکرار است.
function dedupeAdjacent(ws: string[]): string[] {
  return ws.filter((w, i) => i === 0 || w !== ws[i - 1]);
}

// واژه‌ی منفی: «نه»، «هیچ…»، و فعل‌هایِ منفیِ رایج (نمی‌…، نیست، نبود، ندار…، نکن…، …). پیشوندهایی که با واژه‌یِ
// رایجِ غیرمنفی یکی‌اند («نیاز»، «نمونه»، «نشون») عمداً نیامده‌اند. شمارشِ اضافه فقط به سمتِ امن خطا می‌کند
// (تکه‌ی بیشتری به متنِ خام برمی‌گردد)، چون شرط برابریِ خام و خروجی است.
const NEG_PREFIX = /^(نمی|نیست|نبود|نباید|ندار|نداشت|نکن|نکرد|نشد|نشده|نشود|نشه|نخوا|نگو|نگفت|نرو|نرفت|نزن|نزد|نده|نداد|نبین|ندید|نفهم|نذار|نگذار|نتون|نتوان|نیاد|نیام|نیای|نیومد|نیامد|نخور|نپرس|ندون|ندان|نگیر|نگرفت|نساز|نکش)/;
export function negationCount(s: string): number {
  return dedupeAdjacent(words(s)).filter((w) => w === 'نه' || w === 'نخیر' || w.startsWith('هیچ') || NEG_PREFIX.test(w)).length;
}

// عدد: رقم یا واژه‌ی عددی (بدونِ «یک/یه» که بیشتر حرفِ تعریف است). هر دو طرف به مقدار تبدیل می‌شوند تا «ده» و «۱۰» برابر باشند.
const NUM_WORDS: Record<string, number> = {
  دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, ده: 10, یازده: 11, دوازده: 12, سیزده: 13,
  چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, شونزده: 16, هفده: 17, هیفده: 17, هجده: 18, هیجده: 18, نوزده: 19,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, دویست: 200, سیصد: 300,
  پانصد: 500, هزار: 1000, میلیون: 1000000,
};
// «نه» هم عدد است و هم منفی — در شمارشِ عدد شمرده نمی‌شود (منفی سخت‌گیرانه‌تر چک می‌شود).
// نیم‌فاصله این‌جا واژه را نمی‌شکند (2026-09-28، تنها «متنِ نهایی»ِ prod): LLM «پنجشنبه» را درست «پنج‌شنبه» می‌نوشت، words()
// نیم‌فاصله را فاصله می‌کرد و «پنج» عددِ تازه شمرده می‌شد ⇒ کلِ تکه به‌خاطرِ «تغییرِ عدد» خام می‌ماند. نامِ روزها با فاصله هم یکی می‌شوند.
const WEEKDAY_RE = /(^|[^آ-ی])(یک|دو|سه|چهار|پنج)[\s‌]*(شنبه)/g;
export function numberBag(s: string): string[] {
  const out: string[] = [];
  const joined = s.replace(/‌/g, '').replace(WEEKDAY_RE, '$1$2$3');
  for (const w of dedupeAdjacent(words(joined))) {
    if (/^\d+$/.test(w)) out.push(String(Number(w)));
    else if (NUM_WORDS[w] !== undefined) out.push(String(NUM_WORDS[w]));
  }
  return out.sort();
}

export function markers(s: string): string[] {
  return (s.match(MARKER_RE) || []).slice().sort();
}

export function uncertainCount(s: string): number {
  return (s.match(UNCERTAIN_RE) || []).length;
}

function sameBag(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// raw/polished: متنِ خالصِ گفتار (بدونِ برچسبِ گوینده/نقش) — نشانگرها داخلش هستند.
export function checkPolishedChunk(raw: string, polished: string, limits: GuardLimits = DEFAULT_GUARD_LIMITS): GuardFailure | null {
  const rw = words(raw);
  const pw = words(polished);
  if (!pw.length && rw.length) return 'empty';
  if (!sameBag(markers(raw), markers(polished))) return 'marker';
  // واژه‌هایِ کم‌اطمینانِ Soniox در ورودی از پیش ⟦…؟⟧ خورده‌اند (asyncTranscribe.markUncertainTokens). LLM می‌تواند
  // واژه‌ی داخل را از زمینه درست کند، ولی حق ندارد علامت را بردارد — فاز ۰B: متنِ خراب با اطمینان تحویل می‌شد.
  if (uncertainCount(polished) < uncertainCount(raw)) return 'uncertain';
  // طول بر اساسِ واژه‌هایِ بدونِ مکث/تکرار — حذفِ «اِ… من من» نباید رد شود.
  const rLen = dedupeAdjacent(rw).join(' ').length;
  const pLen = dedupeAdjacent(pw).join(' ').length;
  if (rLen > 0) {
    const ratio = pLen / rLen;
    if (ratio < limits.minLengthRatio || ratio > limits.maxLengthRatio) return 'length';
  }
  const rn = negationCount(raw);
  const pn = negationCount(polished);
  if (rn !== pn) return 'negation';
  if (!sameBag(numberBag(raw), numberBag(polished))) return 'number';
  // هم‌پوشانی بدونِ نیم‌فاصله (2026-09-28): اصلاحِ درستِ «نمیدونم» ⇒ «نمی‌دونم» یا «هیچ وقت» ⇒ «هیچ‌وقت» واژه‌یِ خام را
  // «گم‌شده» نشان می‌داد و نوبتِ کوتاه با دو اصلاحِ نیم‌فاصله رد می‌شد. واژه‌ی خام (≥ ۳ نویسه) داخلِ واژه‌یِ چسبیده هم پیداست.
  const rj = words(raw.replace(/‌/g, ''));
  if (rj.length >= 5) {
    const pj = words(polished.replace(/‌/g, ''));
    const set = new Set(pj);
    const flat = pj.join('');
    const uniq = Array.from(new Set(rj));
    const kept = uniq.filter((w) => set.has(w) || (w.length >= 3 && flat.includes(w))).length;
    if (kept / uniq.length < limits.minOverlap) return 'overlap';
  }
  return null;
}
