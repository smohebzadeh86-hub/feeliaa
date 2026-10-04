// هارنسِ تاریخچه‌ی متنِ جلسه (F8، 2026-10-02) — توابعِ خالص: diffِ پاراگرافی. بدونِ DB/شبکه. دادهٔ ساختگی.
// اجرا: pnpm test:hist
import assert from 'node:assert/strict';
import { diffParagraphs, diffSummary, splitParagraphs } from '../server/src/features/sessions/transcriptDiff.js';
import { mergeRecoveryLost, mergeRecoveredSegment, recoveryKey, RECOVERY_LOST_LABEL, trimOverlapWithPreceding, RECOVERED_DUP_LABEL } from '../server/src/features/transcription/batch/recoveryMerge.js';

let pass = 0;
let fail = 0;
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n   ' + (e instanceof Error ? e.stack?.split('\n').slice(0, 3).join('\n   ') : String(e))); }
}

t('H1 splitParagraphs: خطِ خالی جداکننده؛ CRLF و فاصله‌ی اضافه نادیده', () => {
  assert.deepEqual(splitParagraphs('الف\r\n\r\n  ب  \n\n\n'), ['الف', 'ب']);
  assert.deepEqual(splitParagraphs(''), []);
});

t('H2 متنِ یکسان ⇒ همه same', () => {
  const r = diffParagraphs('گوینده ۱: سلام\n\nگوینده ۲: درود', 'گوینده ۱: سلام\n\nگوینده ۲: درود');
  assert.deepEqual(diffSummary(r.ops), { same: 2, removed: 0, added: 0 });
  assert.equal(r.truncated, false);
});

t('H3 ویرایشِ یک پاراگراف ⇒ یک removed + یک added، بقیه same، ترتیبِ متن حفظ', () => {
  const old = 'الف\n\nب قدیمی\n\nج';
  const cur = 'الف\n\nب جدید\n\nج';
  const r = diffParagraphs(old, cur);
  assert.deepEqual(r.ops.map((o) => o.op), ['same', 'removed', 'added', 'same']);
  assert.equal(r.ops[1].text, 'ب قدیمی');
  assert.equal(r.ops[2].text, 'ب جدید');
});

t('H4 حذف و افزودنِ پاراگراف', () => {
  const r = diffParagraphs('الف\n\nب\n\nج', 'الف\n\nج\n\nد');
  assert.deepEqual(diffSummary(r.ops), { same: 2, removed: 1, added: 1 });
  assert.equal(r.ops.find((o) => o.op === 'removed')!.text, 'ب');
  assert.equal(r.ops.find((o) => o.op === 'added')!.text, 'د');
});

t('H5 resolve-speakers مانند: برچسبِ گوینده عوض شده ⇒ همان پاراگراف removed/added، هیچ متنی گم نمی‌شود', () => {
  const old = 'گوینده ۱: من نمی‌دونم\n\nگوینده ۲: چرا';
  const cur = 'درمانگر: من نمی‌دونم\n\nمراجع: چرا';
  const r = diffParagraphs(old, cur);
  const removed = r.ops.filter((o) => o.op === 'removed').map((o) => o.text);
  assert.deepEqual(removed, ['گوینده ۱: من نمی‌دونم', 'گوینده ۲: چرا']);
  // بازسازیِ هر دو طرف از diff (هیچ پاراگرافی گم/تکراری نیست)
  assert.deepEqual(r.ops.filter((o) => o.op !== 'added').map((o) => o.text), splitParagraphs(old));
  assert.deepEqual(r.ops.filter((o) => o.op !== 'removed').map((o) => o.text), splitParagraphs(cur));
});

t('H6 هر دو طرف خالی/یکی خالی', () => {
  assert.deepEqual(diffParagraphs('', '').ops, []);
  assert.deepEqual(diffSummary(diffParagraphs('', 'الف').ops), { same: 0, removed: 0, added: 1 });
  assert.deepEqual(diffSummary(diffParagraphs('الف', '').ops), { same: 0, removed: 1, added: 0 });
});

t('H7 سقفِ اندازه: بیش از ۳۰۰۰ پاراگراف ⇒ truncated بدونِ محاسبه', () => {
  const big = Array.from({ length: 3001 }, (_, i) => 'پ' + i).join('\n\n');
  const r = diffParagraphs(big, 'الف');
  assert.equal(r.truncated, true);
  assert.deepEqual(r.ops, []);
});

t('H8 پاراگراف‌هایِ تکراری: LCS درست (بدونِ فروپاشی)', () => {
  const r = diffParagraphs('الف\n\nالف\n\nب', 'الف\n\nب\n\nالف');
  assert.equal(r.ops.filter((o) => o.op !== 'added').map((o) => o.text).join('|'), 'الف|الف|ب');
  assert.equal(r.ops.filter((o) => o.op !== 'removed').map((o) => o.text).join('|'), 'الف|ب|الف');
});

const PH = (key: string) => '[⏳ بازه‌ی قطعیِ اینترنت — متن در حالِ بازیابی · #' + key + ']';

t('H9 (فاز ۶) placeholderِ بازه‌ای که هرگز رونویسی نمی‌شود ⇒ نشانگرِ «بازیابی نشد»؛ کلید حفظ، متنِ دیگر دست‌نخورده', () => {
  const key = recoveryKey('runA1', 3);
  const cur = 'گوینده ۱: اول\n\n' + PH(key) + '\n\n[اتصال دوباره برقرار شد]\n\nگوینده ۱: بعد';
  const out = mergeRecoveryLost(cur, key)!;
  assert.ok(out.includes('[' + RECOVERY_LOST_LABEL + ' · #' + key + ']'));
  assert.ok(!out.includes('⏳'));
  assert.ok(out.startsWith('گوینده ۱: اول') && out.endsWith('گوینده ۱: بعد') && out.includes('[اتصال دوباره برقرار شد]'));
  // کلید در متن هست ⇒ کلاینت آن را «حل‌شده» می‌بیند (dropResolvedPlaceholders: '#key]' در متنِ سرور)
  assert.ok(out.includes('#' + key + ']'));
});

t('H10 mergeRecoveryLost: placeholder نبود/کلیدِ دیگر/کلیدِ خالی ⇒ null (هیچ‌چیز عوض نمی‌شود)؛ فقط placeholderِ همان کلید', () => {
  const k1 = recoveryKey('runA1', 1), k2 = recoveryKey('runA1', 2);
  const cur = PH(k1) + '\n\n' + PH(k2);
  assert.equal(mergeRecoveryLost('بدونِ placeholder', k1), null);
  assert.equal(mergeRecoveryLost(cur, recoveryKey('runA1', 9)), null);
  assert.equal(mergeRecoveryLost(cur, undefined), null);
  const out = mergeRecoveryLost(cur, k1)!;
  assert.ok(out.includes(PH(k2)), 'placeholderِ بازه‌ی دیگر می‌ماند');
  assert.ok(!out.includes(PH(k1)));
});

t('H11 ترتیبِ رویدادها: بعد از «بازیابی نشد»، رونویسیِ دیرهنگامِ همان بازه دیگر درجا پر نمی‌شود ولی append می‌شود (متن گم نمی‌شود)', () => {
  const key = recoveryKey('runA1', 3);
  const lost = mergeRecoveryLost('الف\n\n' + PH(key), key)!;
  const late = mergeRecoveredSegment(lost, 'متنِ دیرهنگام', key);
  assert.ok(late && late.includes('متنِ دیرهنگام') && late.includes(RECOVERY_LOST_LABEL), late || '');
});

t('H12 (T59) هم‌پوشانیِ سگمنتِ لحظه‌ی قطع: پیشوندی که دُمِ متنِ قبلی است حذف، بقیه دست‌نخورده؛ برچسبِ گوینده حفظ', () => {
  const prev = 'گوینده ۱: سلام امروز حالتون چطوره\n\nگوینده ۲: راستش این هفته خیلی سخت گذشت و';
  const rec = 'گوینده ۱: این هفته خیلی سخت گذشت و نتونستم بخوابم\n\nگوینده ۲: چرا؟';
  const r = trimOverlapWithPreceding(prev, rec);
  assert.equal(r.trimmedWords, 6);
  assert.equal(r.text, 'نتونستم بخوابم\n\nگوینده ۲: چرا؟');
  // ي/ك عربی و علامت‌گذاری هم‌ارزند
  assert.equal(trimOverlapWithPreceding('او گفت كه خيلي خسته است،', 'گفت که خیلی خسته است. بعد رفت').text, 'بعد رفت');
});

t('H13 (T59) محافظه‌کاری: کمتر از ۴ واژه، شروعِ نابرابر یا شباهتِ کم ⇒ هیچ حذفی', () => {
  assert.equal(trimOverlapWithPreceding('من خوبم', 'من خوبم و تو').trimmedWords, 0);
  assert.equal(trimOverlapWithPreceding('الف ب پ ت ث', 'ج ب پ ت ث چ').trimmedWords, 0);
  assert.equal(trimOverlapWithPreceding('یک دو سه چهار پنج شش', 'هفت هشت نه ده یازده').trimmedWords, 0);
  assert.equal(trimOverlapWithPreceding('', 'یک دو سه چهار').text, 'یک دو سه چهار');
});

t('H14 (T59) پرکردنِ placeholder با حذفِ هم‌پوشانی؛ کاملاً تکراری ⇒ نشانگرِ «پیش‌تر ثبت شده» با همان کلید', () => {
  const key = recoveryKey('runA1', 4);
  const cur = 'گوینده ۱: یک دو سه چهار پنج\n\n' + PH(key) + '\n\nبعد';
  const out = mergeRecoveredSegment(cur, 'دو سه چهار پنج شش هفت', key)!;
  assert.ok(out.includes('شش هفت') && !out.includes('سه چهار پنج شش'), out);
  const dup = mergeRecoveredSegment(cur, 'دو سه چهار پنج', key)!;
  assert.ok(dup.includes(RECOVERED_DUP_LABEL + ' · #' + key) && dup.endsWith('بعد'), dup);
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
