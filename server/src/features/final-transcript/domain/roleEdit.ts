// اصلاحِ دستیِ نقشِ گوینده در «متنِ نهایی» (2026-09-28) — خالص، بدونِ I/O.
// درمانگر نقشِ یک پاراگراف (یک یا چند نوبتِ پیاپیِ هم‌نقش) را عوض می‌کند، یا — وقتی شماره‌گذاریِ Soniox در کلِ جلسه یکدست
// است (source=async) — نقشِ همه‌ی نوبت‌هایِ همان گوینده را. متنِ هیچ نوبتی عوض نمی‌شود.
import { renderClean, type CleanTurn } from './transcriptText.js';

export interface RoleEdit {
  indices: number[];
  role: string;
  sameSpeaker: boolean;
}

export type RoleEditResult =
  | { ok: true; turns: CleanTurn[]; text: string; changed: number }
  | { ok: false; error: 'bad-role' | 'bad-index' };

// نقش‌هایِ مجاز: حاضرینِ واحدِ درمان (درمانگر + اعضا)؛ بدونِ آن، نقش‌هایِ موجود در متن + درمانگر/مراجع.
export function allowedRoles(roster: { speakers: string[] } | null, turns: CleanTurn[]): string[] {
  const base = roster && roster.speakers.length
    ? ['درمانگر', ...roster.speakers.map((s) => s.trim())]
    : ['درمانگر', 'مراجع', ...turns.filter((t) => !t.marker).map((t) => t.role.trim())];
  return Array.from(new Set(base.filter(Boolean)));
}

export function applyRoleEdit(turns: CleanTurn[], edit: RoleEdit, allowed: string[]): RoleEditResult {
  const role = String(edit.role || '').trim();
  if (!role || !allowed.includes(role)) return { ok: false, error: 'bad-role' };
  const idx = Array.isArray(edit.indices) ? edit.indices : [];
  if (!idx.length || idx.some((i) => !Number.isInteger(i) || i < 0 || i >= turns.length || turns[i].marker)) {
    return { ok: false, error: 'bad-index' };
  }
  const targets = new Set(idx);
  if (edit.sameSpeaker) {
    const sps = new Set(idx.map((i) => turns[i].sp).filter((s): s is string => !!s));
    turns.forEach((t, i) => { if (!t.marker && t.sp && sps.has(t.sp)) targets.add(i); });
  }
  let changed = 0;
  const next = turns.map((t, i) => {
    if (!targets.has(i) || t.role === role) return t;
    changed++;
    return { ...t, role };
  });
  return { ok: true, turns: next, text: renderClean(next), changed };
}

// ——— پلِ بینِ دو سیستمِ نقش (F7، 2026-10-02) ———
// «متنِ نهایی» نقش را به‌صورتِ نام («درمانگر»/«مراجع»/«آقا»…) نگه می‌دارد؛ رکوردِ canonical (session_speaker_roles) enum + برچسب.
// ویرایشِ نقشِ هم‌گوینده (async) در متنِ نهایی به رکوردِ canonical هم نوشته می‌شود و «ساختِ دوباره» آن را پین می‌کند.
export type CanonicalRole = 'therapist' | 'client' | 'member' | 'other';
const ROLE_NAME: Record<CanonicalRole, string> = { therapist: 'درمانگر', client: 'مراجع', member: 'عضو', other: 'دیگر' };

export function roleNameToEntry(name: string): { role: CanonicalRole; label: string | null } {
  const n = String(name || '').trim();
  if (n === 'درمانگر') return { role: 'therapist', label: null };
  if (n === 'مراجع') return { role: 'client', label: null };
  return { role: 'member', label: n || null };
}

const FA = '۰۱۲۳۴۵۶۷۸۹';
export const toLatinDigits = (s: string): string => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
export const toPersianDigits = (s: string): string => s.replace(/[0-9]/g, (d) => FA[+d]);

// speaker_key (لاتین) ⇒ برچسبِ گوینده با ارقامِ فارسی در متن؛ مقدار = نامِ نقش.
export function confirmedRolesFromEntries(entries: Record<string, { role: string; label: string | null }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(entries || {})) {
    const name = v.label || ROLE_NAME[v.role as CanonicalRole];
    if (name && /^[0-9]+$/.test(key)) out[toPersianDigits(key)] = name;
  }
  return out;
}
