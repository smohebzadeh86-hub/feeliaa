// انواعِ دامنه‌ی «واحدِ درمان» — بدونِ هیچ I/O. کاتالوگ از DB می‌آید (tu_* در migration 029)،
// پس هیچ نوع/نقش/رویکردی اینجا به‌صورتِ ثابت تعریف نشده.

export type AgeGroup = 'child' | 'teen' | 'adult';
export type Gender = 'f' | 'm';

export interface MemberRole {
  code: string;
  labelFa: string;
  gender: Gender | null;       // جنسیتِ ضمنیِ نقش (مثلاً «مادر»)؛ null یعنی از عضو پرسیده می‌شود
  ageGroup: AgeGroup | null;   // گروهِ سنیِ ضمنی
  askAge: boolean;
  askGender: boolean;
  contextLabel: string;        // برچسبِ انگلیسی برایِ context ِSoniox
  sort: number;
}

export interface UnitPreset {
  key: string;
  labelFa: string;
  roles: string[];
  default: boolean;
}

export interface UnitType {
  code: string;
  labelFa: string;
  minMembers: number;
  maxMembers: number;
  allowedRoles: string[];
  presets: UnitPreset[];
  contextSetting: string;
  sort: number;
}

export interface Modality {
  code: string;
  labelFa: string;
  defaultUnit: string | null;
  contextLabel: string;
  terms: string[];
  sort: number;
}

export interface Catalog {
  unitTypes: UnitType[];
  roles: MemberRole[];
  modalities: Modality[];
}

export interface MemberInput {
  id?: string;
  role: string;
  alias?: string | null;
  category?: AgeGroup | null;
  gender?: Gender | null;
}

export interface Member {
  id: string;
  role: string;
  alias: string | null;
  category: AgeGroup | null;
  gender: Gender | null;
  sort: number;
}

export interface TreatmentUnit {
  clientId: string;
  unitType: string;
  members: Member[];
}

export interface SpeakerProfile {
  unitType: UnitType;
  speakers: Array<{ label: string; contextLabel: string; gender: Gender | null; ageGroup: AgeGroup | null }>;
  // تعدادِ کلِ گوینده‌ها با احتسابِ درمانگر — مشتق، هرگز ذخیره نمی‌شود
  speakerCount: number;
}
