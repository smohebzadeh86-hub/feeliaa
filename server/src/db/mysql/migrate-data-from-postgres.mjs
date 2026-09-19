// اسکریپتِ یک‌بارمصرفِ کپیِ داده از Postgres (production فعلی) به MySQL (production جدید).
// جدا از اپِ اصلی است (به pg نیاز دارد که دیگر dependency سرور نیست) — با
// package.json مستقلِ کنارِ همین فایل اجرا می‌شود (نگاه کنید به README-runbook در پاسخِ چت).
//
// ترتیب: therapists -> auth_sessions -> clients -> sessions -> session_notes -> session_audio
// (ترتیبِ FK). فقط INSERT — هیچ UPDATE/DELETEای روی Postgres انجام نمی‌شود (منبع دست‌نخورده می‌ماند).
//
// اجرا:
//   PG_URL=postgresql://... MYSQL_URL=mysql://... node migrate-data-from-postgres.mjs
import pg from 'pg';
import mysql from 'mysql2/promise';

const PG_URL = process.env.PG_URL;
const MYSQL_URL = process.env.MYSQL_URL;
if (!PG_URL || !MYSQL_URL) {
  console.error('PG_URL و MYSQL_URL هر دو لازم‌اند');
  process.exit(1);
}

const pgClient = new pg.Client({ connectionString: PG_URL });
const mysqlUrl = new URL(MYSQL_URL);
const myPool = mysql.createPool({
  host: mysqlUrl.hostname,
  port: Number(mysqlUrl.port || 3306),
  user: decodeURIComponent(mysqlUrl.username),
  password: decodeURIComponent(mysqlUrl.password),
  database: mysqlUrl.pathname.replace(/^\//, ''),
  charset: 'utf8mb4',
});

function toMysqlDatetime(v) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  // MySQL DATETIME: 'YYYY-MM-DD HH:MM:SS' — همیشه UTC (معادلِ رفتارِ قبلیِ TIMESTAMPTZ)
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
function toMysqlBool(v) {
  if (v === null || v === undefined) return null;
  return v ? 1 : 0;
}
function toJson(v) {
  return v === null || v === undefined ? null : JSON.stringify(v);
}

async function copyTable(name, columns, mapRow) {
  const { rows } = await pgClient.query(`SELECT ${columns.join(', ')} FROM ${name}`);
  console.log(`[migrate-data] ${name}: ${rows.length} row(s)`);
  for (const row of rows) {
    const mapped = mapRow(row);
    const cols = Object.keys(mapped);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${placeholders})`;
    await myPool.query(sql, cols.map((c) => mapped[c]));
  }
}

async function main() {
  await pgClient.connect();

  await copyTable(
    'therapists',
    ['id', 'email', 'password_hash', 'name', 'created_at', 'phone', 'is_admin', 'active', 'specialty'],
    (r) => ({
      id: r.id, email: r.email, password_hash: r.password_hash, name: r.name,
      created_at: toMysqlDatetime(r.created_at), phone: r.phone,
      is_admin: toMysqlBool(r.is_admin), active: toMysqlBool(r.active), specialty: r.specialty,
    })
  );

  await copyTable(
    'auth_sessions',
    ['token_hash', 'therapist_id', 'created_at', 'expires_at'],
    (r) => ({
      token_hash: r.token_hash, therapist_id: r.therapist_id,
      created_at: toMysqlDatetime(r.created_at), expires_at: toMysqlDatetime(r.expires_at),
    })
  );

  await copyTable(
    'clients',
    ['id', 'code', 'alias', 'created_at', 'therapist_id', 'status', 'status_reason', 'category', 'gender'],
    (r) => ({
      id: r.id, code: r.code, alias: r.alias, created_at: toMysqlDatetime(r.created_at),
      therapist_id: r.therapist_id, status: r.status, status_reason: r.status_reason,
      category: r.category, gender: r.gender,
    })
  );

  await copyTable(
    'sessions',
    ['id', 'client_id', 'session_num', 'date', 'start_time', 'consent', 'duration_ms', 'status',
     'transcript', 'anchors', 'txt_content', 'created_at', 'updated_at', 'transcript_version',
     'realtime_reliable', 'stt_mode', 'batch_status', 'source'],
    (r) => ({
      id: r.id, client_id: r.client_id, session_num: r.session_num, date: r.date,
      start_time: r.start_time, consent: toMysqlBool(r.consent), duration_ms: r.duration_ms,
      status: r.status, transcript: r.transcript, anchors: toJson(r.anchors), txt_content: r.txt_content,
      created_at: toMysqlDatetime(r.created_at), updated_at: toMysqlDatetime(r.updated_at),
      transcript_version: r.transcript_version, realtime_reliable: toMysqlBool(r.realtime_reliable),
      stt_mode: r.stt_mode, batch_status: r.batch_status, source: r.source,
    })
  );

  await copyTable(
    'session_notes',
    ['id', 'session_id', 'type', 'text', 'sign_type', 'offset_ms', 'wall_clock', 'created_at'],
    (r) => ({
      id: r.id, session_id: r.session_id, type: r.type, text: r.text, sign_type: r.sign_type,
      offset_ms: r.offset_ms, wall_clock: r.wall_clock, created_at: toMysqlDatetime(r.created_at),
    })
  );

  await copyTable(
    'session_audio',
    ['id', 'session_id', 'seq', 'path', 'bytes', 'mime', 'source', 'created_at'],
    (r) => ({
      id: r.id, session_id: r.session_id, seq: r.seq, path: r.path, bytes: r.bytes,
      mime: r.mime, source: r.source, created_at: toMysqlDatetime(r.created_at),
    })
  );

  console.log('[migrate-data] done — همه‌ی جدول‌ها کپی شدند.');
  await pgClient.end();
  await myPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
