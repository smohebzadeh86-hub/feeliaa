// پیشنهادِ نقشِ گوینده (core-data-plan-2026-10-03، قدمِ ۳). خالص و بدونِ DB. پیشنهاد هرگز ذخیره نمی‌شود — فقط تراپیست با
// «تأیید» نقش را در session_speaker_roles می‌نویسد (PUT /speakers). منابع، به ترتیبِ اعتبار:
//   ۱. «متنِ نهایی» (نقشِ LLM یا اصلاحِ تراپیست برایِ هر شماره‌ی گوینده‌ی Soniox) — فقط وقتی گذرِ جاری async است (همان شماره‌ها).
//   ۲. حاضرینِ واحدِ درمان + «درمانگر معمولاً جلسه را شروع می‌کند»: فقط وقتی تعدادِ گوینده‌ها دقیقاً حاضرین + ۱ و فقط یک عضو
//      هست (فردی) — حدس، با برچسبِ guess. چندعضوی: فقط گزینه‌ها (برچسبِ اعضا)، بدونِ حدس.
import type { SpeakerRole } from './segments.js';

export interface SpeakerStat { key: string; firstStartMs: number | null; firstSeq: number }
export interface Suggestion { role: SpeakerRole; label: string | null; source: 'final_transcript' | 'guess' }

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)));
const toFa = (s: string | number) => String(s).replace(/[0-9]/g, (d) => FA[+d]);

export function roleNameToSuggestion(name: string): { role: SpeakerRole; label: string | null } | null {
  const n = String(name || '').trim();
  if (!n) return null;
  if (n === 'درمانگر') return { role: 'therapist', label: null };
  if (n === 'مراجع') return { role: 'client', label: null };
  return { role: 'member', label: n.slice(0, 40) };
}

// realtime: «<runTag>-<برچسب>» ⇒ همان «گوینده N»ِ متن، با «بخشِ k» وقتی جلسه چند run (رفرش) دارد. async/upload: ترتیبِ ظهور.
export function speakerDisplays(keys: string[]): Record<string, string> {
  const rt = keys.every((k) => /^[A-Za-z0-9_]+-\d+$/.test(k));
  const out: Record<string, string> = {};
  if (!rt) { keys.forEach((k, i) => { out[k] = 'گوینده ' + toFa(i + 1); }); return out; }
  const runs: string[] = [];
  for (const k of keys) { const r = k.slice(0, k.lastIndexOf('-')); if (!runs.includes(r)) runs.push(r); }
  for (const k of keys) {
    const r = k.slice(0, k.lastIndexOf('-'));
    const n = k.slice(k.lastIndexOf('-') + 1);
    out[k] = 'گوینده ' + toFa(n) + (runs.length > 1 ? ' (بخشِ ' + toFa(runs.indexOf(r) + 1) + ')' : '');
  }
  return out;
}

export function suggestRoles(input: {
  speakers: SpeakerStat[];
  recordSource: string;
  finalRoles: Record<string, string> | null; // شماره‌ی گوینده (فارسی یا لاتین) ⇒ نامِ نقش
  rosterMembers: string[] | null;            // برچسبِ اعضایِ حاضرِ واحدِ درمان (بدونِ درمانگر)
}): Record<string, Suggestion> {
  const out: Record<string, Suggestion> = {};
  if (input.recordSource === 'async' && input.finalRoles) {
    const byLatin: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.finalRoles)) byLatin[toLatin(String(k))] = v;
    for (const s of input.speakers) {
      const sug = roleNameToSuggestion(byLatin[s.key] ?? '');
      if (sug) out[s.key] = { ...sug, source: 'final_transcript' };
    }
    if (Object.keys(out).length) return out;
  }
  // حدس فقط برایِ جلسه‌ی دونفره‌ی فردی: دقیقاً دو گوینده و حداکثر یک عضو.
  const members = input.rosterMembers ?? null;
  if (input.speakers.length !== 2 || (members && members.length !== 1)) return out;
  const ordered = [...input.speakers].sort((a, b) =>
    (a.firstStartMs ?? Number.MAX_SAFE_INTEGER) - (b.firstStartMs ?? Number.MAX_SAFE_INTEGER) || a.firstSeq - b.firstSeq);
  const clientLabel = members && members[0] && members[0] !== 'مراجع' ? members[0].slice(0, 40) : null;
  out[ordered[0].key] = { role: 'therapist', label: null, source: 'guess' };
  out[ordered[1].key] = clientLabel ? { role: 'client', label: clientLabel, source: 'guess' } : { role: 'client', label: null, source: 'guess' };
  return out;
}
