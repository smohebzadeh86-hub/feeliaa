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
