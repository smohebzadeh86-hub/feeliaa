// نوبت‌هایِ گوینده از توکن‌هایِ زمان‌دار + ساختِ متنِ canonical با نقش. خالص و بدونِ DB.
import type { RecordToken } from './tokens.js';

export interface SegmentDraft {
  seq: number;
  speaker_key: string;
  start_ms: number | null;
  end_ms: number | null;
  text: string;
  confidence_pct: number | null; // میانگینِ اطمینانِ توکن‌هایِ محتوادار ×۱۰۰
}

const SPEAKER_KEY_MAX = 16;

function speakerKeyOf(s: unknown): string | null {
  if (s === undefined || s === null || s === '') return null;
  return String(s).replace(/[^\w-]/g, '').slice(0, SPEAKER_KEY_MAX) || null;
}

// توکن‌هایِ پشتِ‌سرِ‌هم با یک گوینده یک نوبت‌اند. توکنِ بدونِ گوینده به نوبتِ جاری می‌پیوندد (یا '0' اگر اولین است).
export function buildSegments(tokens: RecordToken[] | null | undefined): SegmentDraft[] {
  if (!tokens || !tokens.length) return [];
  type Acc = { key: string; start: number | null; end: number | null; parts: string[]; confSum: number; confN: number };
  const out: SegmentDraft[] = [];
  let cur: Acc | null = null;
  const flush = () => {
    if (!cur) return;
    const text = cur.parts.join('').replace(/\s+/g, ' ').trim();
    if (text) {
      out.push({
        seq: out.length, speaker_key: cur.key, start_ms: cur.start, end_ms: cur.end, text,
        confidence_pct: cur.confN ? Math.round((cur.confSum / cur.confN) * 100) : null,
      });
    }
    cur = null;
  };
  for (const t of tokens) {
    const key: string = speakerKeyOf(t.speaker) ?? (cur ? (cur as Acc).key : '0');
    if (!cur || (cur as Acc).key !== key) { flush(); cur = { key, start: null, end: null, parts: [], confSum: 0, confN: 0 }; }
    const c = cur as Acc;
    c.parts.push(String(t.text ?? ''));
    if (Number.isFinite(t.start_ms) && c.start === null) c.start = Math.round(t.start_ms as number);
    if (Number.isFinite(t.end_ms)) c.end = Math.round(t.end_ms as number);
    if (Number.isFinite(t.confidence) && String(t.text ?? '').trim()) { c.confSum += t.confidence as number; c.confN++; }
  }
  flush();
  return out;
}

export type SpeakerRole = 'therapist' | 'client' | 'member' | 'other';
export const SPEAKER_ROLES: readonly SpeakerRole[] = ['therapist', 'client', 'member', 'other'];
export interface RoleEntry { role: SpeakerRole; label: string | null }

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (n: number | string) => String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
const ROLE_FA: Record<SpeakerRole, string> = { therapist: 'درمانگر', client: 'مراجع', member: 'عضو', other: 'دیگر' };

export function speakerDisplay(key: string, roles: Record<string, RoleEntry> | undefined, ordinal: number): string {
  const r = roles?.[key];
  if (r) return r.label ? r.label : ROLE_FA[r.role];
  return 'گوینده ' + toFa(ordinal);
}

// متنِ canonical با قالبِ «برچسب: متن» (همان قالبِ sessions.transcript) و نوبت‌ها با خطِ خالی جدا.
// شماره‌ی «گوینده N» بر اساسِ ترتیبِ اولین ظهورِ گوینده در گذر.
export function renderCanonicalText(segments: Array<{ speaker_key: string; text: string }>, roles?: Record<string, RoleEntry>): string {
  const order = new Map<string, number>();
  for (const s of segments) if (!order.has(s.speaker_key)) order.set(s.speaker_key, order.size + 1);
  return segments.map((s) => `${speakerDisplay(s.speaker_key, roles, order.get(s.speaker_key)!)}: ${s.text}`).join('\n\n');
}

// نقش‌ها «کامل»اند وقتی همه‌ی گوینده‌هایِ گذر نقش دارند.
export function rolesComplete(speakerKeys: string[], roles: Record<string, RoleEntry>): boolean {
  return speakerKeys.length > 0 && speakerKeys.every((k) => !!roles[k]);
}

export function cleanLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/[\r\n:]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  return t || null;
}
