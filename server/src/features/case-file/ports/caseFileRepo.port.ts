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
  // CAS رویِ محتوا (migration 023، رفعِ F6): هر نوشتنِ content یکی جلو می‌برد.
  contentVersion: number;
}

// ⭐ ستون‌هایِ DATETIME باید با یک شیِ Date نوشته بشن (mysql2 خودش فرمتِ درست می‌ده)، نه
// رشته‌ی ISOِ .toISOString() (فرمتِ `...T...Z` برایِ MySQL DATETIME نامعتبره — باگِ واقعی
// که در تستِ end-to-end پیدا شد: «Incorrect datetime value»).
export type CaseFileUpsertPatch = Partial<Omit<CaseFileRecord, 'clientId' | 'content' | 'contentVersion'>> & {
  content: CaseFileContent;
};

export interface CaseFileRepository {
  get(clientId: string): Promise<CaseFileRecord | null>;
  // ⭐ رفعِ F6: گرفتنِ اتمیکِ قفلِ «در حالِ تولید» — false یعنی تولیدِ زنده‌ی دیگری در جریان است
  // (قبلاً get→check→markGenerating بود و دو درخواستِ هم‌زمان هر دو رد می‌شدند).
  claimGenerating(clientId: string, ttlMs: number): Promise<boolean>;
  // heartbeat — فقط زمانِ قفل را تمدید می‌کند.
  markGenerating(clientId: string): Promise<void>;
  markError(clientId: string, message: string): Promise<void>;
  // expectedVersion داده شود ⇒ CAS: اگر content_version عوض شده باشد null برمی‌گردد و چیزی نوشته نمی‌شود.
  upsert(clientId: string, patch: CaseFileUpsertPatch, expectedVersion?: number): Promise<CaseFileRecord | null>;
}
