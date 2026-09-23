// ارتقای پرونده‌هایِ قدیمی (بدونِ items/changeRows) به ساختارِ «یافته» — بدونِ LLM و بدونِ بازتولید.
// تابعِ خالص: ورودی را تغییر نمی‌دهد. فقط «کارِ AI» ارتقا می‌یابد؛ فیلدِ ویرایش/تاییدشده‌ی تراپیست و فیلدِ pending دست‌نخورده می‌ماند.
//
// برچسب‌هایِ قدیمیِ prompt («شرح وضعیت»، «نقل‌ها و شواهد»، «نکته برای جلسه») نگاشتِ قابل‌اعتماد به نقش دارند؛ بقیه ⇒ other.
// محدودیت‌ها (عمدی): factIds ندارد ⇒ «یک فکت = یک خانه» و نکاتِ کلیدیِ خودکار برایِ این پرونده‌ها اعمال نمی‌شود؛
// برایِ آن‌ها بازتولیدِ کامل لازم است. متنِ ذخیره‌شده (value/body) دست‌نخورده می‌ماند؛ فقط items اضافه می‌شود.
import type { CaseFileContent, CaseFileFinding, FindingRole, CaseFileChangeRow } from '../domain/types.js';
import { findingId, splitSourcePhrase, fallbackLabel, cmpNorm, isQuotesField } from '../domain/findings.js';

const LINE = /^([^:：\n«»]{2,40})[:：]\s*(\S[\s\S]*)$/;
const SUMMARY = /^خلاصه\s*[:：]\s*(.+)$/;

function roleForLabel(label: string): FindingRole {
  const l = label.trim();
  if (/^شرح وضعیت/.test(l)) return 'state';
  if (/^نقل/.test(l) || /^(علائم|نشانه‌ها?|شواهد)/.test(l)) return 'evidence';
  if (/^(تأثیر|پیامد)/.test(l)) return 'impact';
  if (/^(افکار|باورها)/.test(l)) return 'cognition';
  if (/^(عواملِ? زمینه‌ای|پیش[‌ ]?زمینه)/.test(l)) return 'predisposing';
  if (/^(محرک|رویدادِ? آغازگر)/.test(l)) return 'precipitating';
  if (/^(عواملِ? نگه‌دارنده|عواملِ? تشدید|تشدیدکننده‌ها?)/.test(l)) return 'maintaining';
  if (/^(راهبردهای? مقابله|مقابله)/.test(l)) return 'coping';
  if (/^(عواملِ? محافظتی|حمایت)/.test(l)) return 'protective';
  if (/^سابقه‌ی? درمان/.test(l)) return 'treatment_history';
  if (/^پاسخ به مداخله/.test(l)) return 'treatment_response';
  if (/^(اهداف|ارزش‌ها)/.test(l)) return 'goals';
  if (/^تغییر نسبت به قبل/.test(l)) return 'change';
  if (/^(ابهام|اطلاعاتِ? ناکافی)/.test(l)) return 'unknown';
  if (/^نکته برای جلسه/.test(l)) return 'session_note';
  return 'other';
}

interface Parsed { summary: string; items: CaseFileFinding[] }

function parseValue(value: string, opts: { quotes: boolean; withRole: boolean }): Parsed {
  const items: CaseFileFinding[] = [];
  const seen = new Set<string>();
  let summary = '';
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sm = line.match(SUMMARY);
    if (sm && opts.withRole) { summary = sm[1].trim(); continue; }
    let label = '', text = line, source: CaseFileFinding['source'] = 'unspecified';
    if (opts.quotes || /^«.*»[.؛،]?$/.test(line)) {
      text = line.replace(/^«|»[.؛،]?$/g, '').trim();
    } else {
      const m = line.match(LINE);
      if (m) {
        label = m[1].trim();
        const sp = splitSourcePhrase(m[2]);
        text = sp.text; if (sp.source) source = sp.source;
      } else {
        const sp = splitSourcePhrase(line);
        text = sp.text; if (sp.source) source = sp.source;
        label = fallbackLabel(text);
      }
    }
    if (!text) continue;
    const key = cmpNorm(label + text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const fin: CaseFileFinding = { id: findingId(label, text), label, text, source, about: '' };
    if (opts.withRole) fin.role = roleForLabel(label);
    items.push(fin);
  }
  return { summary, items };
}

// فقط کارِ دست‌نخوردهٔ AI: source==='ai'، تاییدنشده‌ی تراپیست، pending نیست، value دارد، items ندارد
const upgradable = (f: { items?: unknown; source: string; pending: boolean; value: string; reviewedByTherapist: boolean }) =>
  !f.items && f.source === 'ai' && !f.reviewedByTherapist && !f.pending && f.value.trim() !== '';

export function upgradeLegacyContent(content: CaseFileContent): { content: CaseFileContent; upgraded: number } {
  const next: CaseFileContent = JSON.parse(JSON.stringify(content));
  let upgraded = 0;

  for (const a of next.axes ?? []) {
    if (!upgradable(a)) continue;
    const p = parseValue(a.value, { quotes: false, withRole: true });
    if (!p.items.length) continue;
    a.items = p.items; upgraded++;
  }

  for (const g of [next.coupleRelationship, next.familyRelationship]) {
    for (const f of g?.fields ?? []) {
      if (!upgradable(f)) continue;
      const p = parseValue(f.value, { quotes: isQuotesField(f), withRole: false });
      if (!p.items.length) continue;
      f.items = p.items; upgraded++;
    }
  }

  // قبل/اکنون: یک ردیفِ اصلی از دو جعبه‌ی قدیمی (اگر دست‌نخورده‌ی AI و حداقل یک طرف پر)
  const co = next.changeOverTime;
  if (!next.changeRows && co) {
    const bOk = upgradable(co.before), aOk = upgradable(co.after);
    const bothAi = (co.before.source === 'ai' && !co.before.reviewedByTherapist) && (co.after.source === 'ai' && !co.after.reviewedByTherapist);
    if (bothAi && (bOk || aOk)) {
      const before = bOk ? co.before.value.trim() : '', after = aOk ? co.after.value.trim() : '';
      const row: CaseFileChangeRow = { id: 'c_' + findingId('', before + '|' + after).slice(2), label: 'تغییر اصلی', before, after };
      next.changeRows = [row]; upgraded++;
    }
  }

  return { content: next, upgraded };
}
