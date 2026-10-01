// سازنده‌ی خالصِ context ِSoniox از پروفایلِ گوینده + رویکردهایِ درمانگر.
// طبقِ docsِ Soniox، context.general (کلید/مقدار) و context.terms به تفکیکِ گوینده و واژگانِ تخصصی کمک می‌کند.
// ⚠️ LAW-001: خودِ buildSonioxContext هیچ نامِ مستعار/یادداشت/دادهٔ بالینی نمی‌گذارد — فقط نقش، سن، جنسیت و تعداد.
// یادداشتِ پیش از جلسه جدا و فقط با withPreNote (تصمیمِ مالک 2026-10-01، قابلِ خاموش با SONIOX_CONTEXT_PRE_NOTE=0) اضافه می‌شود.
import type { Modality, SpeakerProfile } from './types.js';

export interface SonioxContext {
  general: Array<{ key: string; value: string }>;
  terms?: string[];
  // پس‌زمینه‌ی آزادِ جلسه (یادداشتِ پیش از جلسه) — Soniox نام‌ها/اصطلاحاتِ آن را برایِ رونویسی به‌کار می‌برد.
  text?: string;
}

export interface ContextLimits {
  maxTerms: number;
  maxChars: number;
}

export function buildSonioxContext(
  profile: SpeakerProfile | null,
  modalities: Modality[],
  base: SonioxContext,
  limits: ContextLimits
): SonioxContext {
  if (!profile) return base;
  const general = base.general.filter((g) => g.key === 'domain');
  general.push({ key: 'setting', value: `${profile.unitType.contextSetting}, in person, single microphone` });
  const who = ['therapist', ...profile.speakers.map((s) => s.contextLabel)];
  general.push({
    key: 'speakers',
    value: `${profile.speakerCount} distinct speakers expected: ${who.join('; ')}. Separate them by voice.`,
  });
  if (modalities.length) {
    general.push({ key: 'approach', value: modalities.map((m) => m.contextLabel).join(', ') });
  }
  const terms = Array.from(new Set(modalities.flatMap((m) => m.terms))).slice(0, limits.maxTerms);
  const ctx: SonioxContext = terms.length ? { general, terms } : { general };
  // سقفِ طول: اول واژه‌ها کوتاه می‌شوند، بعد رویکرد حذف می‌شود.
  while (JSON.stringify(ctx).length > limits.maxChars && ctx.terms && ctx.terms.length) ctx.terms.pop();
  if (ctx.terms && !ctx.terms.length) delete ctx.terms;
  if (JSON.stringify(ctx).length > limits.maxChars) ctx.general = ctx.general.filter((g) => g.key !== 'approach');
  return ctx;
}

// سقفِ کلِ context ِSoniox ۱۰٬۰۰۰ نویسه است؛ این تابع یادداشت‌هایِ پیش از جلسه را به‌عنوانِ context.text اضافه می‌کند
// (سنجشِ 2026-10-01: صدایِ نویزی با نام‌هایِ کم‌رایج، بدونِ آن ۵ از ۷ نام درست، با آن ۷ از ۷ —
// verification/2026-10-01-pre-note-stt-context.md). maxChars ۰ ⇒ خاموش. خالصِ بدونِ I/O.
export const SONIOX_CONTEXT_HARD_LIMIT = 9500;
export function withPreNote(ctx: SonioxContext, notes: string[], maxChars: number): SonioxContext {
  if (!(maxChars > 0)) return ctx;
  const joined = notes.map((n) => String(n || '').trim()).filter(Boolean).join('\n');
  if (!joined) return ctx;
  const room = SONIOX_CONTEXT_HARD_LIMIT - JSON.stringify(ctx).length - 20;
  const cap = Math.min(maxChars, room);
  if (cap < 50) return ctx;
  return { ...ctx, text: joined.slice(0, cap) };
}
