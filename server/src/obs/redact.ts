// LAW-001: نقطه‌ی اجرای «هیچ متنِ بالینی/آزاد در لاگ نمی‌رود». allowlist نه blocklist —
// هر چیزی که این‌جا صراحتاً مجاز نشده، بی‌صدا حذف می‌شود. هیچ‌جایِ دیگرِ obs/ نباید
// detail را مستقیم (بدونِ عبور از sanitizeDetail) در JSONL/DB بنویسد.
const MAX_KEYS = 12;

// طول ≤۶۴، فقط حروف/رقمِ لاتین + . _ : - — هیچ فاصله، هیچ حرفِ فارسی/یونیکدِ دیگر.
// این مقدار عمداً محدودتر از یک "متنِ کوتاه" است: هدف اجازه‌دادن به شناسه/enum/کدِ
// ماشینی است (مثلِ 'timeout'، 'v2'، session_id) نه هیچ محتوایِ آزادِ کاربر.
const SAFE_TOKEN_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

export function isSafeToken(v: unknown): v is string {
  return typeof v === 'string' && SAFE_TOKEN_RE.test(v);
}

// کلیدهایِ مجازِ detail — فقط متادیتا (طول/شمارش/نسخه/مدت/شناسه)، هرگز محتوایِ آزاد.
// رویدادِ جدید نیاز به کلیدِ جدید دارد؟ اینجا اضافه کن + مستندسازی در database-catalog.md.
export const ALLOWED_DETAIL_KEYS = new Set([
  'len', 'chars', 'count', 'bytes', 'seq',
  'attempt', 'attempts',
  'version', 'prev_version',
  'duration_ms', 'elapsed_ms', 'delay_ms',
  'size', 'status', 'code', 'reason',
  'state', 'prev_state', 'close_code', 'was_clean',
  'kind', 'purpose', 'mode', 'ok',
  'dropped', 'queued', 'retries',
  'model', 'screen', 'run_id', 'source',
]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// تنها گذرگاهِ مجاز برایِ detail قبل از رسیدن به JSONL/DB. ورودیِ نامعتبر → {} (نه throw).
export function sanitizeDetail(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  let n = 0;
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (n >= MAX_KEYS) break;
    if (!ALLOWED_DETAIL_KEYS.has(key)) continue;
    if (isFiniteNumber(raw) || typeof raw === 'boolean') {
      out[key] = raw;
      n++;
      continue;
    }
    if (isSafeToken(raw)) {
      out[key] = raw;
      n++;
    }
    // بقیه (string ناامن، object تودرتو، array، null، undefined، ...) بی‌صدا حذف می‌شود.
  }
  return out;
}
