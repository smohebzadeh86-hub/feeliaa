import type { Catalog, Member } from '../domain/types.js';
import type { NormalizedMember } from '../domain/rules.js';

export interface ClientUnitRow {
  unitType: string;
  category: string | null;
  gender: string | null;
  members: Member[];
}

// پورتِ ذخیره‌سازیِ واحدِ درمان — application فقط این را می‌شناسد، نه SQL.
export interface TreatmentUnitRepo {
  loadCatalog(): Promise<Catalog>;
  getClientUnit(clientId: string): Promise<ClientUnitRow | null>;
  // جایگزینیِ اتمیکِ نوع + اعضا. اعضایی که id ِموجود دارند حفظ می‌شوند (تا attendeesِ جلسه‌های قبلی معتبر بماند).
  replaceUnit(clientId: string, unitType: string, members: NormalizedMember[]): Promise<void>;
  // متنِ یادداشت‌هایِ پیش از جلسه (note_before/voice_before + ستونِ قدیمیِ pre_note) به ترتیبِ ثبت
  getSessionPreNotes(sessionId: string): Promise<string[]>;
  getSessionContextSource(sessionId: string): Promise<{ clientId: string; attendees: string[] | null; therapistModalities: string[] } | null>;
  getTherapistModalities(therapistId: string): Promise<string[]>;
  setTherapistModalities(therapistId: string, codes: string[]): Promise<void>;
}
