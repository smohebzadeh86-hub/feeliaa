// user promptهایِ پرونده: متنِ corpus (application) و پیامِ userِ دو مرحله‌ی digest/compose (adapterها).
import type { ClientCorpus } from '../application/aggregateClientCorpus.js';
import type { CaseFilePromptInput } from '../ports/llmProvider.port.js';
import type { CaseFileAnsweredQuestion } from '../domain/types.js';

const CATEGORY_LABEL: Record<string, string> = { child: 'کودک', teen: 'نوجوان', adult: 'بزرگسال' };
const GENDER_LABEL: Record<string, string> = { f: 'زن', m: 'مرد' };

export function buildCaseFilePrompt(
  corpus: ClientCorpus,
  clientMeta: { category: string | null; gender: string | null; alias: string | null }
): CaseFilePromptInput {
  const lines: string[] = [];
  for (const s of corpus.sessions) {
    lines.push(`--- جلسه‌ی ${s.sessionNum} (تاریخ: ${s.date || 'ثبت نشده'}، منبع: ${s.source === 'manual' ? 'ثبت دستی' : 'جلسه‌ی زنده'}) ---`);
    if (s.transcript && s.transcript.trim()) {
      lines.push(`رونویسی:\n${s.transcript.trim()}`);
    }
    for (const n of s.notes) {
      lines.push(`یادداشت (${n.type}): ${n.text}`);
    }
  }

  return {
    clientMeta,
    corpusText: lines.length
      ? lines.join('\n\n')
      : '(هیچ جلسه/رونویسی/یادداشتی برای این مراجع ثبت نشده است.)',
  };
}

// پاسخ‌هایِ ثبت‌شده به سوالاتِ باز — عمداً وارد ورودیِ مرحله‌ی ۱ (digest) نمی‌شود، چون
// schemaِ digest دقیقاً بر اساسِ جلسه (sessionNum) است و renderDigest فقط digest.sessions را
// بازمی‌سازد؛ هر چیزِ غیرِجلسه‌ای که به مرحله‌ی ۱ برود، در مرحله‌ی ۲ گم می‌شود. این بلوک باید
// مستقیماً بعدِ renderDigest به corpusTextِ مرحله‌ی ۲ چسبانده شود (composeWithRepair در repairLoop.ts).
export function buildAnsweredQuestionsBlock(answeredQuestions: CaseFileAnsweredQuestion[]): string {
  if (!answeredQuestions.length) return '';
  const lines = ['--- پاسخ‌هایِ تراپیست به سوالاتِ پروندهٔ پیشین ---'];
  for (const q of answeredQuestions) lines.push(`سوال: ${q.question}\nپاسخ: ${q.answer}`);
  return lines.join('\n\n');
}

export function describeClientMeta(clientMeta: { category: string | null; gender: string | null }): string {
  const category = clientMeta.category ? CATEGORY_LABEL[clientMeta.category] || clientMeta.category : 'نامشخص';
  const gender = clientMeta.gender ? GENDER_LABEL[clientMeta.gender] || clientMeta.gender : 'نامشخص';
  return `دسته‌ی سنی: ${category} · جنسیت: ${gender}`;
}

// پیامِ userِ مرحله‌ی ۱ (digest): رونویسیِ خامِ جلسات.
export function digestUserPrompt(input: CaseFilePromptInput): string {
  return `${describeClientMeta(input.clientMeta)}

متن خام جلسات ثبت‌شده:
${input.corpusText}`;
}

// پیامِ userِ مرحله‌ی ۲ (compose): input.corpusText خروجیِ رندرشده‌ی digest است.
export function composeUserPrompt(input: CaseFilePromptInput): string {
  return `${describeClientMeta(input.clientMeta)}

خلاصه‌ی تصحیح‌شده‌ی جلسات ثبت‌شده:
${input.corpusText}`;
}
