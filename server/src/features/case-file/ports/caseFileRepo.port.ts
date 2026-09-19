import type { CaseFileContent, CaseFileStatus } from '../domain/types.js';

export interface CaseFileRecord {
  clientId: string;
  content: CaseFileContent;
  status: CaseFileStatus;
  generatingStartedAt: Date | string | null;
  model: string | null;
  promptVersion: number;
  generatedAt: Date | string | null;
  generatedFromSessionId: string | null;
  corpusSignature: string | null;
  therapistEditedAt: Date | string | null;
  forceRegeneratedAt: Date | string | null;
  forceRegeneratedBy: string | null;
  errorMessage: string | null;
}

// ⭐ ستون‌هایِ DATETIME باید با یک شیِ Date نوشته بشن (mysql2 خودش فرمتِ درست می‌ده)، نه
// رشته‌ی ISOِ .toISOString() (فرمتِ `...T...Z` برایِ MySQL DATETIME نامعتبره — باگِ واقعی
// که در تستِ end-to-end پیدا شد: «Incorrect datetime value»).
export type CaseFileUpsertPatch = Partial<Omit<CaseFileRecord, 'clientId' | 'content'>> & {
  content: CaseFileContent;
};

export interface CaseFileRepository {
  get(clientId: string): Promise<CaseFileRecord | null>;
  markGenerating(clientId: string): Promise<void>;
  markError(clientId: string, message: string): Promise<void>;
  upsert(clientId: string, patch: CaseFileUpsertPatch): Promise<CaseFileRecord>;
}
