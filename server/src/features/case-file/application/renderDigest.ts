// digest (خروجیِ مرحله‌ی ۱) را به متنِ ورودیِ مرحله‌ی ۲ تبدیل می‌کند. سرتیترِ
// «--- جلسه‌ی N ---» عمداً همان قالبِ buildCaseFilePrompt است (قاعده‌ی ۸ system prompt).
import type { CaseFileDigest } from '../domain/types.js';
import { factId, quoteId } from '../domain/findings.js';

const CATEGORY_LABEL: Record<string, string> = {
  symptom: 'علائم', event: 'رویداد', relationship: 'رابطه', medication: 'دارو',
  risk: 'خطر/ایمنی', intervention: 'مداخله', other: 'سایر',
};

const SOURCE_LABEL: Record<string, string> = {
  client_report: 'به گفته‌ی مراجع', therapist_observation: 'مشاهده در جلسه', therapist_inference: 'به توصیف درمانگر',
};

export function renderDigest(digest: CaseFileDigest): string {
  const parts: string[] = [];
  if (digest.overallStory?.trim()) parts.push(`داستان کلی روند درمان:\n${digest.overallStory.trim()}`);
  for (const s of digest.sessions) {
    const lines = [`--- جلسه‌ی ${s.sessionNum} (تاریخ: ${s.date || 'ثبت نشده'}، منبع: ${s.source || 'نامشخص'}) ---`];
    if (s.correctedText?.trim()) lines.push(`متن تصحیح‌شده:\n${s.correctedText.trim()}`);
    if (s.facts?.length) {
      // شناسه‌ی هر فکت/نقل (S2F3، S2Q1) همان است که مرحله‌ی ۲ در factIds ارجاع می‌دهد و کد با آن
      // حفظِ اطلاعات را مکانیکی چک می‌کند (domain/findings.ts).
      lines.push('فکت‌ها:\n' + s.facts.map((f, i) => {
        const tags = [factId(s.sessionNum, i), CATEGORY_LABEL[f.category] || f.category];
        if (f.about?.trim()) tags.push(f.about.trim());
        if (f.source && f.source !== 'unspecified') tags.push(SOURCE_LABEL[f.source] || f.source);
        return `- [${tags.join(' · ')}] ${f.text}`;
      }).join('\n'));
    }
    if (s.quotes?.length) lines.push('نقل‌های عینی:\n' + s.quotes.map((q, i) => `- [${quoteId(s.sessionNum, i)}] «${q}»`).join('\n'));
    if (s.ambiguities?.length) lines.push('ابهام‌ها (حدس نزن؛ در صورت نیاز pending):\n' + s.ambiguities.map((a) => `- ${a}`).join('\n'));
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}
