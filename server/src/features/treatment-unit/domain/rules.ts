// قواعدِ خالصِ واحدِ درمان: اعتبارسنجیِ اعضا، حاضرینِ جلسه، و استخراجِ پروفایلِ گوینده.
// همه‌چیز از کاتالوگ خوانده می‌شود — این فایل هیچ نقش/نوعِ مشخصی را نمی‌شناسد.
import { TreatmentUnitValidationError as VErr } from './errors.js';
import type { AgeGroup, Catalog, Gender, Member, MemberInput, MemberRole, SpeakerProfile, TreatmentUnit, UnitType } from './types.js';

const AGE_GROUPS: readonly AgeGroup[] = ['child', 'teen', 'adult'];
const GENDERS: readonly Gender[] = ['f', 'm'];
export const MAX_ALIAS_LEN = 80;

export function findUnitType(catalog: Catalog, code: string): UnitType | undefined {
  return catalog.unitTypes.find((u) => u.code === code);
}
export function findRole(catalog: Catalog, code: string): MemberRole | undefined {
  return catalog.roles.find((r) => r.code === code);
}
export function defaultPreset(unit: UnitType) {
  return unit.presets.find((p) => p.default) ?? unit.presets[0];
}

// اعضایِ ورودی را اعتبارسنجی و نرمال می‌کند. سن/جنسیتِ ضمنیِ نقش بر ورودی غلبه دارد.
export type NormalizedMember = Omit<Member, 'id'> & { id?: string };
export function normalizeMembers(catalog: Catalog, unitCode: string, input: MemberInput[]): NormalizedMember[] {
  const unit = findUnitType(catalog, unitCode);
  if (!unit) throw new VErr('unit-type-invalid', 'نوعِ پرونده نامعتبر است');
  if (!Array.isArray(input)) throw new VErr('members-invalid', 'فهرستِ اعضا نامعتبر است');
  if (input.length < unit.minMembers || input.length > unit.maxMembers) {
    throw new VErr('members-count', `تعدادِ اعضا برایِ «${unit.labelFa}» باید بینِ ${unit.minMembers} و ${unit.maxMembers} باشد`);
  }
  return input.map((m, i) => {
    if (!m || typeof m.role !== 'string' || !unit.allowedRoles.includes(m.role)) {
      throw new VErr('member-role-invalid', 'نقشِ عضو برایِ این نوعِ پرونده مجاز نیست');
    }
    const role = findRole(catalog, m.role);
    if (!role) throw new VErr('member-role-invalid', 'نقشِ عضو نامعتبر است');
    const alias = typeof m.alias === 'string' && m.alias.trim() ? m.alias.trim() : null;
    if (alias && alias.length > MAX_ALIAS_LEN) throw new VErr('alias-too-long', 'نامِ مستعار بیش از حد طولانی است');
    if (m.category != null && !AGE_GROUPS.includes(m.category)) throw new VErr('member-category-invalid', 'گروهِ سنی نامعتبر است');
    if (m.gender != null && !GENDERS.includes(m.gender)) throw new VErr('member-gender-invalid', 'جنسیت نامعتبر است');
    return {
      ...(typeof m.id === 'string' ? { id: m.id } : {}),
      role: role.code,
      alias,
      category: role.ageGroup ?? (role.askAge ? m.category ?? null : null),
      gender: role.gender ?? (role.askGender ? m.gender ?? null : null),
      sort: i,
    };
  });
}

// مراجعِ قدیمی (یا فردیِ بدونِ ردیفِ عضو): یک عضوِ ضمنی از ستون‌هایِ clients.
export const IMPLICIT_MEMBER_ID = 'self';
export function implicitIndividualMember(catalog: Catalog, client: { category: string | null; gender: string | null }): Member {
  const unit = findUnitType(catalog, 'individual');
  const roleCode = unit?.allowedRoles[0] ?? 'client';
  return {
    id: IMPLICIT_MEMBER_ID,
    role: roleCode,
    alias: null,
    category: (AGE_GROUPS as readonly string[]).includes(client.category ?? '') ? (client.category as AgeGroup) : null,
    gender: (GENDERS as readonly string[]).includes(client.gender ?? '') ? (client.gender as Gender) : null,
    sort: 0,
  };
}

// برچسبِ نمایشیِ عضو: مستعار، وگرنه «نقش» + شماره اگر نقشِ هم‌نام تکرار شده باشد.
export function memberLabels(catalog: Catalog, members: Member[]): Map<string, string> {
  const byLabel = new Map<string, number>();
  for (const m of members) {
    const l = findRole(catalog, m.role)?.labelFa ?? m.role;
    byLabel.set(l, (byLabel.get(l) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const out = new Map<string, string>();
  for (const m of members) {
    if (m.alias) { out.set(m.id, m.alias); continue; }
    const l = findRole(catalog, m.role)?.labelFa ?? m.role;
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    out.set(m.id, (byLabel.get(l) ?? 0) > 1 ? `${l} ${n}` : l);
  }
  return out;
}

// حاضرینِ جلسه: null/خالی ⇒ همه‌ی اعضا (پیش‌فرض). شناسه‌یِ ناشناخته رد می‌شود.
export function resolveAttendees(unit: TreatmentUnit, attendeeIds: unknown): string[] {
  const all = unit.members.map((m) => m.id);
  if (attendeeIds == null) return all;
  if (!Array.isArray(attendeeIds) || attendeeIds.some((x) => typeof x !== 'string')) {
    throw new VErr('attendees-invalid', 'فهرستِ حاضرین نامعتبر است');
  }
  const ids = Array.from(new Set(attendeeIds as string[]));
  if (ids.length === 0) throw new VErr('attendees-empty', 'حداقل یک نفر از اعضا باید حاضر باشد');
  if (ids.some((id) => !all.includes(id))) throw new VErr('attendees-unknown', 'عضوِ انتخاب‌شده در این پرونده نیست');
  return ids;
}

export function speakerProfile(catalog: Catalog, unit: TreatmentUnit, attendeeIds: string[] | null): SpeakerProfile | null {
  const unitType = findUnitType(catalog, unit.unitType);
  if (!unitType) return null;
  const present = unit.members.filter((m) => !attendeeIds || attendeeIds.includes(m.id));
  const labels = memberLabels(catalog, unit.members);
  const speakers = present.map((m) => {
    const role = findRole(catalog, m.role);
    return {
      label: labels.get(m.id) ?? m.role,
      contextLabel: describeForContext(role, m),
      gender: m.gender,
      ageGroup: m.category,
    };
  });
  return { unitType, speakers, speakerCount: speakers.length + 1 };
}

const AGE_EN: Record<AgeGroup, string> = { child: 'child', teen: 'teenager', adult: 'adult' };
const GENDER_EN: Record<Gender, string> = { f: 'female', m: 'male' };
function describeForContext(role: MemberRole | undefined, m: Member): string {
  const base = role?.contextLabel ?? 'client';
  // برچسبِ نقش خودش سن/جنسیت را دارد؛ فقط آنچه پرسیده شده اضافه می‌شود.
  const extra = [
    role?.askAge && m.category ? AGE_EN[m.category] : null,
    role?.askGender && m.gender ? GENDER_EN[m.gender] : null,
  ].filter(Boolean);
  return extra.length ? `${base} (${extra.join(', ')})` : base;
}
