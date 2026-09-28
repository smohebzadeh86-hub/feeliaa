// فیلترها و صفحه‌بندیِ مشترکِ فهرست‌هایِ ادمین (آرشیوِ صدا / یادداشت‌هایِ صوتی).
// ————— فیلترهایِ مشترکِ آرشیوِ صدا / یادداشت‌هایِ صوتی (B2/B3، 2026-09-26) —————
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// سکوت: همان آستانه‌ی diagnosis — جلساتِ سالم ۱۱–۲۵ kbps؛ زیرِ ۶ با بیش از ۲۰ث صدا یعنی میکروفون چیزی نگرفته.
export const SILENT_KBPS = 6;
export function audioFilters(q: Record<string, string | undefined>, alias: { therapist: string; client: string; ts: string }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.therapist_id && UUID_RE.test(q.therapist_id)) { where.push(`${alias.therapist} = ?`); params.push(q.therapist_id); }
  if (q.client_id && UUID_RE.test(q.client_id)) { where.push(`${alias.client} = ?`); params.push(q.client_id); }
  if (q.from && DATE_RE.test(q.from)) { where.push(`${alias.ts} >= ?`); params.push(q.from + ' 00:00:00'); }
  if (q.to && DATE_RE.test(q.to)) { where.push(`${alias.ts} < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(q.to + ' 00:00:00'); }
  return { sql: where.length ? ' AND ' + where.join(' AND ') : '', params };
}
export function pageParams(q: Record<string, string | undefined>) {
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
  const offset = Math.max(0, Number(q.offset) || 0);
  return { limit, offset };
}
