// «یافته» (Finding) — واحدِ پایه‌ی اطلاعاتِ پرونده. منطقِ خالص و قطعی (بدونِ I/O و بدونِ LLM):
// شناسه‌ی فکت‌هایِ digest، جداکردنِ عبارتِ منبع از متن، عینیِ نقل‌ها، و بازیابیِ فکتِ رابطه‌ایِ گم‌شده.
// اصلِ طراحی: حفظِ اطلاعات با کد تضمین می‌شود، نه با قولِ مدل — مدل فقط دسته‌بندی/ارجاع می‌دهد.
import type {
  CaseFileDigest, CaseFileDraft, CaseFileFinding, DraftAxis, DraftRelationshipField, DraftRelationshipGroup,
  CaseFileChangeRow, CaseFileRef, FindingRole, FindingSource, RawAxis, RawCaseFileDraft, RawChange, RawCoupleGroup, RawFinding,
} from './types.js';
import { FINDING_ROLES } from './types.js';

// ----- شناسه‌ها: موقعیتی و روی همان digestی که به مرحله‌ی ۲ رندر می‌شود (ذخیره نمی‌شود) -----
export const factId = (sessionNum: number, i: number) => `S${sessionNum}F${i + 1}`;
export const quoteId = (sessionNum: number, i: number) => `S${sessionNum}Q${i + 1}`;

export interface DigestEntry {
  id: string;
  kind: 'fact' | 'quote';
  text: string;
  source: FindingSource;
  about: string;
  category: string;
}

export function indexDigest(digest: CaseFileDigest | null): Map<string, DigestEntry> {
  const map = new Map<string, DigestEntry>();
  for (const s of digest?.sessions ?? []) {
    (s.facts ?? []).forEach((f, i) => {
      const id = factId(s.sessionNum, i);
      map.set(id, { id, kind: 'fact', text: f.text, source: f.source, about: f.about ?? '', category: f.category });
    });
    (s.quotes ?? []).forEach((q, i) => {
      const id = quoteId(s.sessionNum, i);
      map.set(id, { id, kind: 'quote', text: q, source: 'unspecified', about: '', category: 'quote' });
    });
  }
  return map;
}

// ----- نرمال‌سازیِ مقایسه‌ای -----
// بدونِ نیم‌فاصله/فاصله/نشانه‌گذاری تا «می‌شود»/«میشود» یکی شوند.
export const cmpNorm = (s: string) => s.replace(/[‌\s.,،؛:!؟?«»"'()\-—]/g, '');

const STOP = new Set(['مراجع', 'همسر', 'همسرش', 'است', 'بود', 'بود.', 'های', 'این', 'برای', 'خیلی', 'دیگر', 'باشد', 'شده', 'کرد', 'می‌کند', 'میکند']);
export const stems = (s: string) => s.replace(/[.,،؛:!؟?«»"'()\-—]/g, ' ').split(/\s+/)
  .map(w => w.replace(/‌/g, '')).filter(w => w.length >= 4 && !STOP.has(w)).map(w => w.slice(0, 4));

// ----- عبارتِ منبع -----
export const SOURCE_PHRASE: Record<Exclude<FindingSource, 'unspecified'>, string> = {
  client_report: 'به گفته‌ی مراجع',
  therapist_observation: 'مشاهده در جلسه',
  therapist_inference: 'به توصیف درمانگر',
};
const PHRASES: [Exclude<FindingSource, 'unspecified'>, RegExp][] = [
  ['client_report', /^(به گفته‌ی مراجع|به روایت مراجع)\s*[،:：—-]?\s*/],
  ['therapist_observation', /^(مشاهده در جلسه|مشاهده‌ی درمانگر)\s*[،:：—-]?\s*/],
  ['therapist_inference', /^(به توصیف درمانگر)\s*[،:：—-]?\s*/],
];

// عبارتِ منبعِ ابتدای متن (که مدل گاهی داخلِ متن می‌آورد) از متن جدا می‌شود؛ منبع فقط در فیلدِ source می‌ماند.
export function splitSourcePhrase(text: string): { text: string; source: FindingSource | null } {
  const t = text.trim();
  for (const [source, re] of PHRASES) {
    const m = t.match(re);
    if (m) return { text: t.slice(m[0].length).trim(), source };
  }
  return { text: t, source: null };
}

export function isSourcePhraseLabel(label: string): boolean {
  const l = label.trim();
  return PHRASES.some(([, re]) => re.test(l + ' ')) && l.split(/\s+/).length <= 4;
}

function stableHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export const findingId = (label: string, text: string) => 'f_' + stableHash(cmpNorm(label) + '|' + cmpNorm(text));

export const fallbackLabel = (text: string) => text.split(/\s+/).slice(0, 3).join(' ').replace(/[:：،.]+$/, '');
const MAX_LABEL = 40;
// «فردِ مرتبط» که فقط خودِ مراجع است اطلاعاتی نمی‌دهد: نه برچسبِ خوبی است نه چیپِ مفیدی (دیده‌شده: نکته‌ی کلیدی با برچسبِ «مراجع»)
const isGenericAbout = (a: string) => /^(خودِ? ?)?مراجع$/.test(a.trim());
const meaningfulAbout = (a: string) => (a && !isGenericAbout(a) ? a.trim() : '');

export const isQuotesField = (f: { key: string; label: string }) => f.key.trim() === 'quotes' || /نقل/.test(f.label);

// value مشتق از items: همان قالبِ «برچسب: [عبارتِ منبع، ]متن» که ویرایش/merge/نمایشِ قدیمی می‌شناسند.
export function deriveValue(items: CaseFileFinding[], isQuotes: boolean): string {
  return items.map(it => {
    if (isQuotes) return `«${it.text}»`;
    const phrase = it.source !== 'unspecified' ? SOURCE_PHRASE[it.source] + '، ' : '';
    return `${it.label}: ${phrase}${it.text}`;
  }).join('\n');
}

export interface FinalizeReport {
  // فکتِ رابطه‌ایِ digest که نه ارجاع شد نه در جایِ دیگرِ پرونده ردی داشت (کد آن را به «موارد دیگر» برد)
  orphanFacts: DigestEntry[];
  // نقلی که عینِ هیچ نقلِ digest نبود (حذف شد؛ نقلِ درست با ارجاع/تطبیق می‌آید)
  unmatchedQuotes: string[];
  // یافته‌ای که برچسبش نامعتبر بود (خالی/بلند/عبارتِ منبع) و کد برچسبِ جایگزین ساخت
  badLabels: string[];
  // یافته‌ای که فکتش جایِ دیگری «خانه‌ی کامل» داشت و تکرارش حذف شد (اطلاعات گم نمی‌شود؛ فقط تکرارِ کامل نمی‌آید).
  // فقط اطلاعاتی است، در reportProblems نمی‌آید: حذفِ تکرار قطعی است و retry (چند دقیقه) لازم ندارد.
  droppedDuplicates: number;
}

export function reportProblems(r: FinalizeReport): string[] {
  const out: string[] = [];
  for (const o of r.orphanFacts.slice(0, 8)) {
    out.push(`فکتِ ${o.id} در پرونده نیامده و باید بیاید (حذف ممنوع؛ شناسه‌اش را در factIds یک یافته‌ی مناسب بیاور): «${o.text.slice(0, 90)}»`);
  }
  for (const q of r.unmatchedQuotes.slice(0, 4)) {
    out.push(`نقلِ «${q.slice(0, 50)}» عینِ نقلِ ورودی نیست — فقط با شناسه‌ی نقل (مثل S2Q1 در factIds) و کلمه‌به‌کلمه بیاور`);
  }
  for (const l of r.badLabels.slice(0, 4)) {
    out.push(`برچسبِ «${l.slice(0, 40)}» نامعتبر است — باید موضوعِ کوتاهِ همان یافته (۲ تا ۴ کلمه) باشد، نه عبارتِ منبع`);
  }
  return out;
}

// مقصدِ فکت‌هایِ یتیم — چیزی هرگز حذف نمی‌شود
const OTHER_KEY = 'other';
const OTHER_LABEL = 'موارد دیگر';
const OTHER_AXIS_TITLE = 'سایر موارد';

interface Ctx {
  digest: CaseFileDigest | null;
  index: Map<string, DigestEntry>;
  digestQuotes: DigestEntry[];
  referenced: Set<string>;
  report: FinalizeReport;
  // شناسه‌ی فکت‌هایِ هر یافته (برایِ «یک فکت = یک خانه‌ی کامل»؛ در یافته‌ی ذخیره‌شده نمی‌ماند)
  ids: WeakMap<CaseFileFinding, string[]>;
}

// یک یافته‌ی غیرِنقل را نهایی می‌کند (منبع از فیلد، برچسبِ معتبر، ردِ ارجاع‌ها)؛ متنِ خالی ⇒ null
function processItem(it: RawFinding, ctx: Ctx, role?: FindingRole): CaseFileFinding | null {
  const ids = (it.factIds ?? []).filter(id => ctx.index.has(id));
  ids.forEach(id => ctx.referenced.add(id));
  const { text, source: phraseSource } = splitSourcePhrase(it.text);
  if (!text) return null;
  let label = it.label.trim().replace(/[:：]+$/, '');
  if (!label || label.length > MAX_LABEL || isSourcePhraseLabel(label)) {
    ctx.report.badLabels.push(label || '(خالی)');
    label = fallbackLabel(text);
  }
  const fromDigest = ids.map(id => ctx.index.get(id)!).find(e => e.kind === 'fact');
  const source: FindingSource = it.source !== 'unspecified' ? it.source : (phraseSource ?? fromDigest?.source ?? 'unspecified');
  const about = it.about?.trim() || fromDigest?.about || '';
  const fin: CaseFileFinding = { id: findingId(label, text), label, text, source, about, ...(role ? { role } : {}) };
  ctx.ids.set(fin, ids);
  return fin;
}

// نقل: متنش همیشه از digest می‌آید (کلمه‌به‌کلمه)، نه از خروجیِ مدل
function processQuote(it: RawFinding, ctx: Ctx): CaseFileFinding | null {
  const ids = (it.factIds ?? []).filter(id => ctx.index.has(id));
  ids.forEach(id => ctx.referenced.add(id));
  let entry = ids.map(id => ctx.index.get(id)!).find(e => e.kind === 'quote');
  const stripped = it.text.replace(/^«|»[.؛،]?$/g, '').trim();
  if (!entry && stripped) {
    const n = cmpNorm(stripped);
    entry = ctx.digestQuotes.find(q => cmpNorm(q.text).includes(n) || n.includes(cmpNorm(q.text)));
  }
  let text: string;
  if (entry) { text = entry.text; ctx.referenced.add(entry.id); }
  else if (!ctx.digest) text = stripped;          // بدونِ digest چیزی برایِ تطبیق نیست
  else { if (stripped) ctx.report.unmatchedQuotes.push(stripped); return null; }
  if (!text) return null;
  const fin: CaseFileFinding = { id: findingId('', text), label: '', text, source: 'unspecified', about: '' };
  ctx.ids.set(fin, entry ? [...new Set([...ids, entry.id])] : ids);
  return fin;
}

// «یک فکت = یک خانه‌ی کامل» (قانونِ ۱-ب سندِ جامع) با اولویتِ ثابت: زوجین ← خانواده ← محورها.
// یافته‌ای که «همه‌ی» فکت‌هایش جایِ دیگری خانه دارند حذف می‌شود (اطلاعات همان‌جا می‌ماند)؛ یافته‌ی
// بدونِ ارجاع قابلِ تشخیص نیست و می‌ماند. key_people فهرستِ کوتاهِ افراد است و عمداً مستثناست.
// نقل‌ها هم همین‌طور: خانه‌ی نقل‌ها نقشِ quotes است، نه محور/خانواده.
function dedupeSingleHome(
  couple: DraftRelationshipGroup | null, family: DraftRelationshipGroup, axes: DraftAxis[], ctx: Ctx,
  changeHomes: { row: CaseFileChangeRow; ids: string[] }[] = []
): DraftAxis[] {
  // خانه‌ی هر فکت: مکان + یافته + برچسبِ «کجا» برایِ ارجاعِ متقاطع
  const home = new Map<string, { loc: string; it: CaseFileFinding; where: string }>();
  const visit = (loc: string, where: string, items: CaseFileFinding[], exempt: boolean): { kept: CaseFileFinding[]; refs: CaseFileRef[] } => {
    if (exempt) return { kept: items, refs: [] };
    const refs: CaseFileRef[] = [];
    const kept = items.filter(it => {
      const ids = ctx.ids.get(it) ?? [];
      if (!ids.length) return true;
      if (ids.every(id => home.has(id) && home.get(id)!.loc !== loc)) {
        ctx.report.droppedDuplicates++;
        const h = home.get(ids[0])!;
        if (!refs.some(r => r.findingId === h.it.id)) refs.push({ label: it.label || h.it.label || 'نقلِ عینی', where: h.where, findingId: h.it.id });
        return false;
      }
      ids.forEach(id => { if (!home.has(id)) home.set(id, { loc, it, where }); });
      return true;
    });
    return { kept, refs };
  };
  // ردیف‌هایِ قبل/اکنون «خانه‌ی کامل»ِ تغییرند (اولویتِ اول)؛ یافته‌ی محور که همان فکت را دارد حذف و ارجاع می‌شود
  for (const { row, ids } of changeHomes) {
    const pseudo: CaseFileFinding = { id: row.id, label: row.label, text: '', source: 'unspecified', about: '' };
    ids.forEach(id => { if (!home.has(id)) home.set(id, { loc: 'change:' + row.id, it: pseudo, where: 'قبل/اکنون — ' + row.label }); });
  }
  for (const [name, g] of [['couple', couple], ['family', family]] as const) {
    if (!g) continue;
    g.fields = g.fields.filter(f => {
      const had = f.items!.length;
      const r = visit(name + ':' + f.key, g.title + ' — ' + f.label, f.items!, f.key === 'key_people');
      f.items = r.kept;
      if (r.refs.length) f.refs = r.refs;
      return !(had > 0 && f.items.length === 0); // فیلدی که همه‌ی محتوایش تکرار بود نمی‌ماند
    });
  }
  return axes.filter(a => {
    const had = a.items!.length;
    const r = visit('axis:' + a.title, 'محور: ' + a.title, a.items!, false);
    a.items = r.kept;
    if (r.refs.length) a.refs = r.refs;
    return !(had > 0 && a.items.length === 0);
  });
}

const MAX_CHANGE_ROWS = 3;
// ردیف‌هایِ قبل/اکنون: جمله‌هایِ مدل با trim؛ ردیفِ کاملاً خالی حذف؛ حداکثر ۳؛ ارجاعِ فکت‌ها برایِ ردیابی/dedupe
function finalizeChanges(changes: RawChange[], ctx: Ctx): { rows: CaseFileChangeRow[]; homes: { row: CaseFileChangeRow; ids: string[] }[] } {
  const rows: CaseFileChangeRow[] = []; const homes: { row: CaseFileChangeRow; ids: string[] }[] = [];
  for (const c of changes ?? []) {
    const before = c.before.trim(), after = c.after.trim();
    if (!before && !after) continue;
    if (rows.length >= MAX_CHANGE_ROWS) break;
    const ids = (c.factIds ?? []).filter(id => ctx.index.has(id));
    ids.forEach(id => ctx.referenced.add(id));
    const label = c.label.trim().replace(/[:：]+$/, '');
    const row: CaseFileChangeRow = { id: 'c_' + stableHash(cmpNorm(before) + '|' + cmpNorm(after)), label: label && label.length <= MAX_LABEL ? label : fallbackLabel(before || after), before, after };
    if (rows.some(r => r.id === row.id)) continue;
    rows.push(row); homes.push({ row, ids });
  }
  return { rows, homes };
}

function finalizeGroup(group: RawCoupleGroup, ctx: Ctx): DraftRelationshipGroup {
  const fields: DraftRelationshipField[] = [];
  for (const f of group.fields) {
    const isQuotes = isQuotesField(f);
    const seen = new Set<string>();
    const items: CaseFileFinding[] = [];
    for (const it of f.items) {
      const fin = isQuotes ? processQuote(it, ctx) : processItem(it, ctx);
      if (!fin) continue;
      const key = cmpNorm(fin.label + fin.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(fin);
    }
    fields.push({ key: f.key, label: f.label, pending: false, items, value: '' });
  }
  return { title: group.title, fields };
}

const roleRank = (r?: FindingRole) => { const i = FINDING_ROLES.indexOf(r ?? 'other'); return i < 0 ? FINDING_ROLES.length : i; };

// بدنه‌ی مشتقِ محور: سطرِ «خلاصه: …» + هر یافته «برچسب: [منبع، ]متن» به ترتیبِ ثابتِ نقش‌ها
export function deriveAxisBody(summary: string, items: CaseFileFinding[]): string {
  const lines: string[] = [];
  if (summary.trim()) lines.push(`خلاصه: ${summary.trim()}`);
  for (const it of items) {
    const phrase = it.source !== 'unspecified' ? SOURCE_PHRASE[it.source] + '، ' : '';
    lines.push(`${it.label}: ${phrase}${it.text}`);
  }
  return lines.join('\n');
}

// بعد از جابه‌جاییِ یافته، value (بدنه‌ی مشتق) دوباره از رویِ items ساخته می‌شود؛ فقط اگر محور دست‌نخورده‌ی AI باشد
// (متنِ ویرایش/تاییدشده‌ی تراپیست هرگز بازنویسی نمی‌شود). ترتیبِ نقش‌ها ثابت می‌ماند.
export function rebuildAxisValue(a: { value: string; pending: boolean; source: string; reviewedByTherapist: boolean; items?: CaseFileFinding[] }): void {
  if (!a.items) return;
  a.items.sort((x, y) => roleRank(x.role) - roleRank(y.role));
  if (a.source !== 'ai' || a.reviewedByTherapist) return;
  const m = a.value.match(/^خلاصه\s*[:：]\s*(.+)$/m);
  a.value = deriveAxisBody(m ? m[1] : '', a.items);
  a.pending = !a.value.trim();
}

function finalizeAxes(axes: RawAxis[], ctx: Ctx): { axes: DraftAxis[]; summaries: Map<DraftAxis, string> } {
  const summaries = new Map<DraftAxis, string>();
  const out: DraftAxis[] = axes.map(a => {
    const seen = new Set<string>();
    const items: CaseFileFinding[] = [];
    for (const it of a.items) {
      const role: FindingRole = (FINDING_ROLES as readonly string[]).includes(it.role) ? it.role : 'other';
      const fin = processItem(it, ctx, role);
      if (!fin) continue;
      const key = cmpNorm(fin.label + fin.text);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(fin);
    }
    items.sort((x, y) => roleRank(x.role) - roleRank(y.role)); // sort پایدار؛ ترتیبِ نسبیِ هم‌نقش‌ها حفظ می‌شود
    const axis: DraftAxis = {
      title: a.title, body: '', pending: false, statusTone: a.statusTone,
      sensitiveDoNotDiscussInFrontOfClient: a.sensitiveDoNotDiscussInFrontOfClient, items,
    };
    summaries.set(axis, a.summary ?? '');
    return axis;
  });
  return { axes: out, summaries };
}

const rawText = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? ''));

// همه‌ی کارهایِ قطعیِ بعد از مدل اینجاست: منبع/نقلِ عینی/برچسب + ردیابیِ مکانیکیِ حفظِ اطلاعات برایِ
// «همه‌ی» بخش‌هایِ یافته‌محور (زوجین، خانواده، محورها).
export function finalizeDraft(raw: RawCaseFileDraft, digest: CaseFileDigest | null): { draft: CaseFileDraft; report: FinalizeReport } {
  const report: FinalizeReport = { orphanFacts: [], unmatchedQuotes: [], badLabels: [], droppedDuplicates: 0 };
  const index = indexDigest(digest);
  const ctx: Ctx = { digest, index, digestQuotes: [...index.values()].filter(e => e.kind === 'quote'), referenced: new Set(), report, ids: new WeakMap() };

  const couple = raw.coupleRelationship ? finalizeGroup(raw.coupleRelationship, ctx) : null;
  const family = finalizeGroup(raw.familyRelationship, ctx);
  const fin = finalizeAxes(raw.axes, ctx);
  const summaries = fin.summaries;
  const changes = finalizeChanges(raw.changes, ctx);
  const axes = dedupeSingleHome(couple, family, fin.axes, ctx, changes.homes);

  // ردیابیِ مکانیکی: هر فکتِ digest (هر دسته‌ای) یا ارجاع شده یا جایِ دیگرِ پرونده ردی دارد؛ وگرنه کد آن را با
  // متن و منبعِ خودش نگه می‌دارد. روندِ جلسات (sessionsSummary) عمداً در «ردی دارد» حساب نمی‌شود: نمای زمان
  // با نمای وضعیت متعامد است و حضور در یکی جایگزینِ دیگری نیست.
  if (digest) {
    const hay = new Set(stems([
      ...[couple, family].flatMap(g => (g?.fields ?? []).flatMap(f => f.items!.map(i => i.text))),
      ...axes.flatMap(a => a.items!.map(i => i.text)),
      rawText(raw.identity.value), rawText(raw.mainIssue.value), rawText(raw.overallStatus.value), rawText(raw.safetyRisk.value),
      rawText(raw.sensitiveContext.value), rawText(raw.medication), rawText(changes.rows),
    ].join(' ')));
    const relDest = couple ?? family;
    const ensureField = (g: DraftRelationshipGroup) => {
      let f = g.fields.find(x => x.key === OTHER_KEY);
      if (!f) { f = { key: OTHER_KEY, label: OTHER_LABEL, pending: false, items: [], value: '' }; g.fields.push(f); }
      return f;
    };
    let otherAxis: DraftAxis | undefined;
    for (const e of index.values()) {
      if (e.kind !== 'fact' || ctx.referenced.has(e.id)) continue;
      const st = [...new Set(stems(e.text))];
      // ردِ لغوی: فکتِ بلند با ۵۰٪ِ ریشه‌ها؛ فکتِ کوتاه (<۳ ریشه) فقط با ۱۰۰٪ (وگرنه یتیم ⇒ حفظ ارجح بر تکرار)
      if (st.length > 0 && st.filter(x => hay.has(x)).length / st.length >= (st.length >= 3 ? 0.5 : 1)) continue;
      report.orphanFacts.push(e);
      const { text, source } = splitSourcePhrase(e.text);
      const fin: CaseFileFinding = {
        id: findingId('', text), label: meaningfulAbout(e.about) || fallbackLabel(text), text,
        source: e.source !== 'unspecified' ? e.source : (source ?? 'unspecified'), about: meaningfulAbout(e.about),
      };
      ctx.ids.set(fin, [e.id]);
      if (e.category === 'relationship') { ensureField(relDest).items!.push(fin); continue; }
      if (!otherAxis) {
        otherAxis = axes.find(a => a.title === OTHER_AXIS_TITLE);
        if (!otherAxis) {
          otherAxis = { title: OTHER_AXIS_TITLE, body: '', pending: false, statusTone: 'watch', sensitiveDoNotDiscussInFrontOfClient: false, items: [] };
          axes.push(otherAxis); summaries.set(otherAxis, '');
        }
      }
      const axFin: CaseFileFinding = { ...fin, role: e.category === 'symptom' ? 'evidence' : 'other' };
      ctx.ids.set(axFin, [e.id]);
      otherAxis.items!.push(axFin);
    }
    if (otherAxis) otherAxis.items!.sort((x, y) => roleRank(x.role) - roleRank(y.role));
  }

  for (const g of [couple, family]) {
    for (const f of g?.fields ?? []) {
      f.pending = f.items!.length === 0;
      f.value = f.pending ? '' : deriveValue(f.items!, isQuotesField(f));
    }
  }
  for (const a of axes) {
    const summary = summaries.get(a) ?? '';
    a.pending = a.items!.length === 0 && !summary.trim();
    a.body = deriveAxisBody(summary, a.items!);
  }
  // ترتیبِ محورها بر اساسِ وزنِ بالینی: حساس ← نیازمندِ توجه ← مطلوب؛ «سایر موارد» همیشه آخر. sort پایدار است،
  // پس در هر لحن ترتیبِ مدل حفظ می‌شود.
  const toneRank: Record<string, number> = { sensitive: 0, watch: 1, good: 2 };
  const isOther = (a: DraftAxis) => (a.title === OTHER_AXIS_TITLE ? 1 : 0);
  axes.sort((a, b) => isOther(a) - isOther(b) || (toneRank[a.statusTone] ?? 1) - (toneRank[b.statusTone] ?? 1));

  // نکات کلیدی: هر نکته‌ی خام (factIds) به «یافته‌ی نهایی» وصل می‌شود که بیشترین همپوشانیِ فکت را دارد؛ اشاره‌گر است،
  // نه کپیِ متن. فهرستِ افراد (key_people) نکته‌ی کلیدی نمی‌شود (خلاصه‌ی کوتاهِ افراد است). حداکثر ۳، بدونِ تکرار.
  const candidates: CaseFileFinding[] = [
    ...axes.flatMap(a => a.items ?? []),
    ...[couple, family].flatMap(g => (g?.fields ?? []).filter(f => f.key !== 'key_people').flatMap(f => f.items ?? [])),
  ];
  const keyPointIds: string[] = [];
  for (const kp of raw.keyPoints ?? []) {
    const want = new Set((kp.factIds ?? []).filter(id => index.has(id)));
    if (!want.size) continue;
    let best: CaseFileFinding | undefined; let bestOverlap = 0;
    for (const f of candidates) {
      const ov = (ctx.ids.get(f) ?? []).filter(id => want.has(id)).length;
      if (ov > bestOverlap) { best = f; bestOverlap = ov; }
    }
    if (best && !keyPointIds.includes(best.id)) keyPointIds.push(best.id);
  }

  const { keyPoints: _rawKeyPoints, changes: _rawChanges, ...rest } = raw;
  void _rawKeyPoints; void _rawChanges;
  // changeOverTime = ردیفِ اول (برایِ ویرایش/merge/پرونده‌های قدیمی)
  const main = changes.rows[0];
  const changeOverTime = {
    before: { value: main?.before ?? '', pending: !(main?.before ?? '').trim() },
    after: { value: main?.after ?? '', pending: !(main?.after ?? '').trim() },
  };
  return { draft: { ...rest, coupleRelationship: couple, familyRelationship: family, axes, keyPointIds: keyPointIds.slice(0, 3), changeOverTime, changeRows: changes.rows } as CaseFileDraft, report };
}
