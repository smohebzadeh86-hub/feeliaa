// digest (خروجیِ مرحله‌ی ۱) را به متنِ ورودیِ مرحله‌ی ۲ تبدیل می‌کند. سرتیترِ
// «--- جلسه‌ی N ---» عمداً همان قالبِ buildCaseFilePrompt است (قاعده‌ی ۸ system prompt).
import type { CaseFileDigest } from '../domain/types.js';

const CATEGORY_LABEL: Record<string, string> = {
  symptom: 'علائم', event: 'رویداد', relationship: 'رابطه', medication: 'دارو',
  risk: 'خطر/ایمنی', intervention: 'مداخله', other: 'سایر',
};

export function renderDigest(digest: CaseFileDigest): string {
  const parts: string[] = [];
  if (digest.overallStory?.trim()) parts.push(`داستان کلی روند درمان:\n${digest.overallStory.trim()}`);
  for (const s of digest.sessions) {
    const lines = [`--- جلسه‌ی ${s.sessionNum} (تاریخ: ${s.date || 'ثبت نشده'}، منبع: ${s.source || 'نامشخص'}) ---`];
    if (s.correctedText?.trim()) lines.push(`متن تصحیح‌شده:\n${s.correctedText.trim()}`);
    if (s.facts?.length) lines.push('فکت‌ها:\n' + s.facts.map((f) => `- [${CATEGORY_LABEL[f.category] || f.category}] ${f.text}`).join('\n'));
    if (s.quotes?.length) lines.push('نقل‌های عینی:\n' + s.quotes.map((q) => `- «${q}»`).join('\n'));
    if (s.ambiguities?.length) lines.push('ابهام‌ها (حدس نزن؛ در صورت نیاز pending):\n' + s.ambiguities.map((a) => `- ${a}`).join('\n'));
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}
