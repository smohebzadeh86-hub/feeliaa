// جاروبِ دوره‌ایِ obs_events/obs_ui_events — الگو دقیقاً از sweepOldSessionAudio
// (server/src/stt/sessionAudioArchive.ts) گرفته شده: حذفِ تکه‌تکه با LIMIT، نه یک
// DELETEِ عظیم که می‌تواند جدول را برایِ مدتی قفل کند.
// طبقِ تصمیمِ D-E مالک: حذفِ تراپیست/مراجع هیچ پاکسازیِ آبشاری‌ای در این جدول‌ها
// نمی‌سازد — این تنها مسیرِ پاکسازیِ obs_* است، و فقط بر اساسِ سن.
import { query } from '../db/connection.js';
import { hardDeleteAllowed } from '../shared/retention.js';

const OBS_EVENTS_RETENTION_DAYS = Number(process.env.OBS_EVENTS_RETENTION_DAYS) > 0
  ? Number(process.env.OBS_EVENTS_RETENTION_DAYS) : 180;
const OBS_UI_RETENTION_DAYS = Number(process.env.OBS_UI_RETENTION_DAYS) > 0
  ? Number(process.env.OBS_UI_RETENTION_DAYS) : 30;
// ممیزی (audit_log، migration 028): ۲ سال — تصمیمِ مالک 2026-09-26 («۲ سال»). مثلِ obs_* بدونِ FK و فقط بر اساسِ سن.
export const AUDIT_LOG_RETENTION_DAYS = Number(process.env.AUDIT_LOG_RETENTION_DAYS) > 0
  ? Number(process.env.AUDIT_LOG_RETENTION_DAYS) : 730;

const CHUNK = 5000;
const MAX_ROUNDS = 400;
const DELAY_MS = 50;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sweepTable(table: 'obs_events' | 'obs_ui_events' | 'audit_log', retentionDays: number): Promise<number> {
  let totalDeleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const del = await query(
      `DELETE FROM ${table} WHERE ts < DATE_SUB(NOW(), INTERVAL ? DAY) ORDER BY id LIMIT ?`,
      [retentionDays, CHUNK]
    );
    totalDeleted += del.rowCount;
    if (del.rowCount < CHUNK) break;
    await delay(DELAY_MS);
  }
  return totalDeleted;
}

export async function sweepOldObsEvents(): Promise<void> {
  // ⭐ «هیچ چیزی هارد دیلیت نشود» (2026-10-02): رصد و ممیزی هم نگه داشته می‌شوند مگر ALLOW_HARD_DELETE=1
  if (!hardDeleteAllowed()) return;
  try {
    const events = await sweepTable('obs_events', OBS_EVENTS_RETENTION_DAYS);
    const ui = await sweepTable('obs_ui_events', OBS_UI_RETENTION_DAYS);
    const audit = await sweepTable('audit_log', AUDIT_LOG_RETENTION_DAYS);
    if (events || ui || audit) {
      console.log(`[obs] swept ${events} obs_events row(s), ${ui} obs_ui_events row(s), ${audit} audit_log row(s)`);
    }
  } catch (e) {
    console.log('[obs] sweep failed:', String(e).slice(0, 160));
  }
}
