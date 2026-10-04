#!/usr/bin/env node
// سنجشِ دقتِ رونویسی و تفکیکِ گوینده (core-data-plan-2026-10-03، قدمِ ۶) — آفلاین، بدونِ DB/شبکه، فقط عدد چاپ می‌کند.
//
// ورودی:
//   --ref=<file.txt>   رونوشتِ مرجعِ انسانی: هر پاراگراف/خط «برچسبِ گوینده: متن» (برچسبِ اول تا اولین «:»)؛ خطِ بدونِ برچسب ادامه‌ی گوینده‌ی قبل.
//   --hyp=<file>       خروجیِ سیستم: (الف) فایلِ export ادمین (JSON، schema ≥ 2) + --session=<uuid> ⇒ نوبت‌هایِ canonical
//                      (speaker_key، confidence_pct)؛ (ب) .txt با همان قالبِ مرجع (مثلاً متنِ جلسه با «گوینده N:»).
//   --json             خروجیِ JSON به‌جایِ متن.
//   --self-test        تست‌هایِ داخلی (بدونِ فایل).
//
// خروجی (LAW-001: هیچ واژه/متنی چاپ نمی‌شود):
//   WER (کلی و برایِ هر گوینده‌ی مرجع؛ جایگزینی/حذف/درج)، WER بدونِ نیم‌فاصله (حساسیت به «می‌روم/میروم»)،
//   خطایِ انتسابِ گوینده در سطحِ واژه (DER-lite: نسبتِ واژه‌هایِ هم‌ترازی که گوینده‌شان با بهترین نگاشتِ یک‌به‌یک نمی‌خواند)،
//   و اگر hyp اطمینان دارد: نرخِ خطا در نوبت‌هایِ کم‌اطمینان در برابرِ پراطمینان.
//
// داده: فقط جلساتِ نقش‌آفرینی یا جلساتی با رضایتِ صریحِ جداگانه (core-data-plan §۶). خروجیِ هر اجرا ⇒ فایلِ تاریخ‌دار در verification/.
import fs from 'node:fs';

// ——— نرمال‌سازیِ فارسی ———
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function normalizeWord(w, { joinZwnj = false } = {}) {
  let s = String(w)
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ۀة]/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و')
    .replace(/[ً-ْٰـ]/g, '') // اعراب و کشیده
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .toLowerCase();
  s = joinZwnj ? s.replace(/‌/g, '') : s;
  return s.replace(/[^\p{L}\p{N}‌]/gu, '').replace(/^‌+|‌+$/g, '');
}
export function tokenize(text, opts) {
  // ZWNJ داخلِ واژه می‌ماند (مگر joinZwnj)؛ فاصله و علائم جداکننده‌اند
  return String(text).split(/[\s]+/).map((w) => normalizeWord(w, opts)).filter(Boolean);
}

// ——— خواندنِ ورودی‌ها ⇒ [{speaker, words:[...], conf}] ———
const LABEL_RE = /^\s*([^:\n]{1,40}?)\s*[:：]\s*(.*)$/;
export function parseLabelled(text) {
  const out = [];
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\s*\[[^\]]*\]\s*$/.test(line)) continue; // نشانگرها: [اتصال دوباره…]، [علامت…]، [بازیابی‌شده…]
    const m = line.match(LABEL_RE);
    if (m) { cur = { speaker: m[1].trim(), text: m[2] }; out.push(cur); }
    else if (cur) cur.text += ' ' + line;
    else { cur = { speaker: '?', text: line }; out.push(cur); }
  }
  return out.map((t) => ({ speaker: t.speaker, text: t.text.replace(/\[[^\]\n]*\]/g, ' '), conf: null }));
}
function findSession(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findSession(x, id); if (r) return r; } return null; }
  if (node.id === id && 'canonical' in node) return node;
  for (const v of Object.values(node)) { const r = findSession(v, id); if (r) return r; }
  return null;
}
export function turnsFromExport(json, sessionId) {
  const s = findSession(json, sessionId);
  if (!s) throw new Error('session-not-found');
  const segs = s.canonical?.segments;
  if (Array.isArray(segs) && segs.length) {
    return segs.map((g) => ({ speaker: String(g.speaker_key), text: g.text, conf: typeof g.confidence_pct === 'number' ? g.confidence_pct / 100 : null }));
  }
  if (typeof s.transcript === 'string') return parseLabelled(s.transcript);
  throw new Error('no-canonical-or-transcript');
}
function flatten(turns, opts) {
  const words = [];
  turns.forEach((t, ti) => { for (const w of tokenize(t.text, opts)) words.push({ w, speaker: t.speaker, turn: ti, conf: t.conf }); });
  return words;
}

// ——— هم‌ترازیِ Levenshtein با backtrace ———
export function align(ref, hyp) {
  const n = ref.length, m = hyp.length;
  // جدولِ کامل با Uint32 (ردیف به ردیف برایِ حافظه؛ backtrace با جهت‌ها)
  const dir = new Uint8Array((n + 1) * (m + 1)); // 0 diag-match, 1 diag-sub, 2 up(del), 3 left(ins)
  let prev = new Uint32Array(m + 1), cur = new Uint32Array(m + 1);
  for (let j = 0; j <= m; j++) { prev[j] = j; dir[j] = 3; }
  for (let i = 1; i <= n; i++) {
    cur[0] = i; dir[i * (m + 1)] = 2;
    for (let j = 1; j <= m; j++) {
      const eq = ref[i - 1].w === hyp[j - 1].w;
      const d = prev[j - 1] + (eq ? 0 : 1), u = prev[j] + 1, l = cur[j - 1] + 1;
      let best = d, k = eq ? 0 : 1;
      if (u < best) { best = u; k = 2; }
      if (l < best) { best = l; k = 3; }
      cur[j] = best; dir[i * (m + 1) + j] = k;
    }
    [prev, cur] = [cur, prev];
  }
  const pairs = []; // {r, h, op}
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const k = i === 0 ? 3 : j === 0 ? 2 : dir[i * (m + 1) + j];
    if (k === 0 || k === 1) { pairs.push({ r: i - 1, h: j - 1, op: k === 0 ? 'C' : 'S' }); i--; j--; }
    else if (k === 2) { pairs.push({ r: i - 1, h: null, op: 'D' }); i--; }
    else { pairs.push({ r: null, h: j - 1, op: 'I' }); j--; }
  }
  return pairs.reverse();
}

function werOf(pairs, nRef) {
  const c = { S: 0, D: 0, I: 0, C: 0 };
  for (const p of pairs) c[p.op]++;
  return { wer: nRef ? (c.S + c.D + c.I) / nRef : null, sub: c.S, del: c.D, ins: c.I, ref_words: nRef };
}

// بهترین نگاشتِ یک‌به‌یکِ گوینده‌یِ hyp ⇒ گوینده‌یِ مرجع (حریصانه رویِ ماتریسِ هم‌وقوعی؛ برایِ N کوچک کافی).
export function speakerAttribution(pairs, ref, hyp) {
  const co = new Map();
  let aligned = 0;
  for (const p of pairs) {
    if (p.r === null || p.h === null) continue;
    aligned++;
    const k = hyp[p.h].speaker + '\u0000' + ref[p.r].speaker;
    co.set(k, (co.get(k) || 0) + 1);
  }
  const entries = [...co.entries()].map(([k, n]) => { const [h, r] = k.split('\u0000'); return { h, r, n }; }).sort((a, b) => b.n - a.n);
  const mapH = new Map(), usedR = new Set();
  for (const e of entries) if (!mapH.has(e.h) && !usedR.has(e.r)) { mapH.set(e.h, e.r); usedR.add(e.r); }
  let wrong = 0;
  for (const p of pairs) if (p.r !== null && p.h !== null && mapH.get(hyp[p.h].speaker) !== ref[p.r].speaker) wrong++;
  const refSpk = new Set(ref.map((x) => x.speaker)), hypSpk = new Set(hyp.map((x) => x.speaker));
  return { speaker_error: aligned ? wrong / aligned : null, aligned_words: aligned, ref_speakers: refSpk.size, hyp_speakers: hypSpk.size };
}

export function evaluate(refTurns, hypTurns) {
  const ref = flatten(refTurns), hyp = flatten(hypTurns);
  const pairs = align(ref, hyp);
  const overall = werOf(pairs, ref.length);
  // بدونِ نیم‌فاصله
  const refJ = flatten(refTurns, { joinZwnj: true }), hypJ = flatten(hypTurns, { joinZwnj: true });
  const overallJ = werOf(align(refJ, hypJ), refJ.length);
  // برایِ هر گوینده‌ی مرجع: خطاهایِ منتسب به واژه‌هایِ آن گوینده (درج‌ها به گوینده‌ی واژه‌ی مرجعِ قبلی)
  const per = new Map();
  let lastSpk = ref.length ? ref[0].speaker : '?';
  for (const p of pairs) {
    const spk = p.r !== null ? ref[p.r].speaker : lastSpk;
    if (p.r !== null) lastSpk = spk;
    const a = per.get(spk) || { S: 0, D: 0, I: 0, n: 0 };
    if (p.r !== null) a.n++;
    if (p.op !== 'C') a[p.op]++;
    per.set(spk, a);
  }
  const ordinal = new Map();
  for (const t of refTurns) if (!ordinal.has(t.speaker)) ordinal.set(t.speaker, ordinal.size + 1);
  const per_speaker = [...per.entries()].map(([spk, a]) => ({
    ref_speaker: ordinal.get(spk) ?? 0, // شماره، نه برچسبِ مرجع (برچسب ممکن است نام باشد — LAW-001)
    ref_words: a.n, wer: a.n ? (a.S + a.D + a.I) / a.n : null,
  })).sort((x, y) => x.ref_speaker - y.ref_speaker);
  // اطمینان در برابرِ خطا (فقط اگر hyp اطمینانِ نوبت دارد)
  let confidence = null;
  if (hyp.some((x) => typeof x.conf === 'number')) {
    const bins = { low: { err: 0, n: 0 }, high: { err: 0, n: 0 } };
    for (const p of pairs) {
      if (p.h === null || typeof hyp[p.h].conf !== 'number') continue;
      const b = hyp[p.h].conf < 0.8 ? bins.low : bins.high;
      b.n++; if (p.op !== 'C') b.err++;
    }
    confidence = {
      threshold: 0.8,
      low_turn_words: bins.low.n, low_turn_error: bins.low.n ? bins.low.err / bins.low.n : null,
      high_turn_words: bins.high.n, high_turn_error: bins.high.n ? bins.high.err / bins.high.n : null,
    };
  }
  return { overall, overall_zwnj_joined: overallJ, per_speaker, speakers: speakerAttribution(pairs, ref, hyp), confidence, hyp_words: hyp.length };
}

const pct = (x) => (x === null || x === undefined ? '—' : (x * 100).toFixed(2) + '%');
function printText(r) {
  const o = r.overall;
  console.log(`WER: ${pct(o.wer)}  (S=${o.sub} D=${o.del} I=${o.ins}، واژه‌یِ مرجع=${o.ref_words}، واژه‌یِ خروجی=${r.hyp_words})`);
  console.log(`WER بدونِ نیم‌فاصله: ${pct(r.overall_zwnj_joined.wer)}`);
  for (const s of r.per_speaker) console.log(`  گوینده‌ی مرجعِ ${s.ref_speaker}: WER ${pct(s.wer)} (${s.ref_words} واژه)`);
  const k = r.speakers;
  console.log(`خطایِ انتسابِ گوینده (واژه‌ای): ${pct(k.speaker_error)}  (گوینده‌یِ مرجع=${k.ref_speakers}، گوینده‌یِ خروجی=${k.hyp_speakers}، واژه‌یِ هم‌تراز=${k.aligned_words})`);
  if (r.confidence) {
    const c = r.confidence;
    console.log(`اطمینانِ نوبت < ${c.threshold}: خطا ${pct(c.low_turn_error)} (${c.low_turn_words} واژه) · پراطمینان: خطا ${pct(c.high_turn_error)} (${c.high_turn_words} واژه)`);
  }
}

function selfTest() {
  const assert = (c, m) => { if (!c) { console.error('FAIL ' + m); process.exitCode = 1; } else console.log('PASS ' + m); };
  assert(normalizeWord('خيلي') === 'خیلی' && normalizeWord('كتاب،') === 'کتاب' && normalizeWord('۱۲') === '12', 'E1 نرمال‌سازی: ي/ك عربی، علائم، ارقام');
  assert(normalizeWord('می‌روم', { joinZwnj: true }) === 'میروم' && normalizeWord('می‌روم') === 'می‌روم', 'E2 نیم‌فاصله فقط با joinZwnj حذف می‌شود');
  const same = evaluate(parseLabelled('الف: سلام خوبی\nب: ممنون'), parseLabelled('گوینده ۱: سلام خوبی\nگوینده ۲: ممنون'));
  assert(same.overall.wer === 0 && same.speakers.speaker_error === 0 && same.speakers.hyp_speakers === 2, 'E3 متنِ یکسان با برچسبِ متفاوت ⇒ WER صفر، انتسابِ صفر (نگاشتِ برچسب)');
  const r = evaluate(parseLabelled('الف: یک دو سه چهار'), parseLabelled('x: یک دو پنج چهار شش'));
  assert(r.overall.sub === 1 && r.overall.ins === 1 && r.overall.del === 0 && Math.abs(r.overall.wer - 0.5) < 1e-9, 'E4 یک جایگزینی + یک درج روی ۴ واژه ⇒ WER ۵۰٪');
  const sp = evaluate(parseLabelled('الف: یک دو\nب: سه چهار'), parseLabelled('x: یک دو سه\ny: چهار'));
  assert(Math.abs(sp.speakers.speaker_error - 0.25) < 1e-9, 'E5 یک واژه به گوینده‌ی اشتباه از ۴ ⇒ خطایِ انتساب ۲۵٪');
  const ex = { therapists: [{ clients: [{ sessions: [{ id: 'S1', canonical: { segments: [
    { speaker_key: 'a-1', text: 'یک دو', confidence_pct: 95 }, { speaker_key: 'a-2', text: 'سه پنج', confidence_pct: 40 }] } }] }] }] };
  const e = evaluate(parseLabelled('الف: یک دو\nب: سه چهار'), turnsFromExport(ex, 'S1'));
  assert(e.overall.sub === 1 && e.confidence && e.confidence.low_turn_error === 0.5 && e.confidence.high_turn_error === 0, 'E6 خروجیِ export: نوبت‌هایِ canonical + اطمینانِ کم ⇒ خطایِ بیشتر');
  assert(parseLabelled('[اتصال دوباره برقرار شد]\nالف: سلام [علامت: گریه] خوبی').map((t) => t.text.trim().split(/\s+/).length)[0] === 2, 'E7 نشانگرهایِ […] نادیده');
  let threw = false; try { turnsFromExport(ex, 'nope'); } catch { threw = true; }
  assert(threw, 'E8 جلسه‌ی ناموجود ⇒ خطا');
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
if (args['self-test']) {
  selfTest();
} else if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (!args.ref || !args.hyp) {
    console.error('usage: pnpm eval:asr -- --ref=<ref.txt> --hyp=<export.json|hyp.txt> [--session=<uuid>] [--json]');
    process.exit(2);
  }
  const refTurns = parseLabelled(fs.readFileSync(args.ref, 'utf8'));
  const hypRaw = fs.readFileSync(args.hyp, 'utf8');
  let hypTurns;
  if (/\.json$/i.test(args.hyp)) {
    if (!args.session) { console.error('--session=<uuid> لازم است (ورودیِ export)'); process.exit(2); }
    hypTurns = turnsFromExport(JSON.parse(hypRaw), args.session);
  } else hypTurns = parseLabelled(hypRaw);
  const r = evaluate(refTurns, hypTurns);
  if (args.json) console.log(JSON.stringify(r, null, 2)); else printText(r);
}
