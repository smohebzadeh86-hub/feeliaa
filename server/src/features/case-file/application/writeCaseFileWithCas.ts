import type { CaseFileRepository, CaseFileRecord } from '../ports/caseFileRepo.port.js';
import { dropGhostMedication, migrateAnsweredQuestions } from './applyFieldPatch.js';

// ⭐ رفعِ F6: هر ویرایشِ تراپیست read→modify→write است؛ با CAS رویِ content_version نوشته می‌شود تا
// نه دو ویرایشِ هم‌زمان هم‌دیگر را پاک کنند، نه پایانِ یک تولیدِ پس‌زمینه ویرایش را. در تعارض
// (نسخه بینِ خواندن و نوشتن عوض شد) همان تغییر رویِ آخرین نسخه دوباره اعمال می‌شود.
export type CaseFileMutate = (content: CaseFileRecord['content']) => CaseFileRecord['content'];
export async function writeCaseFileWithCas(
  caseFileRepo: CaseFileRepository,
  clientId: string,
  mutate: CaseFileMutate,
  extra: { therapistEditedAt?: Date } = {},
  prepare: (content: CaseFileRecord['content']) => void = (c) => { dropGhostMedication(c); migrateAnsweredQuestions(c); }
): Promise<CaseFileRecord | 'not-found' | 'conflict'> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const record = await caseFileRepo.get(clientId);
    if (!record) return 'not-found';
    prepare(record.content);
    const nextContent = mutate(record.content);
    const updated = await caseFileRepo.upsert(clientId, { content: nextContent, ...extra }, record.contentVersion);
    if (updated) return updated;
  }
  return 'conflict';
}
