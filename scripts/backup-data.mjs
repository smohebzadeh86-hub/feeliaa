// پشتیبان‌گیریِ فقط‌افزودنی (2026-10-02، تصمیمِ مالک: «همه‌چیز قابلِ بازیابی باشد، هیچی هارد دیلیت نشه»).
// ⚠️ هرگز چیزی را پاک یا بازنویسی نمی‌کند: هر اجرا یک پوشه‌یِ تازه‌یِ تاریخ‌دار می‌سازد؛ فایل‌هایِ صدا/آپلود در یک mirrorِ پایدار
// فقط «اضافه/به‌روز» می‌شوند (حتی اگر منبع پاک شده باشد، نسخه‌یِ mirror می‌ماند). به DB فقط SELECT می‌زند.
// خروجی: <out>/<stamp>/{schema.sql, <table>.ndjson, manifest.json} + <out>/files-mirror/<session-audio|uploads|batch-queue>/…
// ⚠️ حاویِ دادهٔ بالینی است: پوشه‌یِ خروجی را خارج از git و با دسترسیِ محدود نگه دارید (backups/ در .gitignore است).
// اجرا:  node scripts/backup-data.mjs [--out=DIR] [--only=t1,t2] [--no-files] [--data-dir=DIR] [--dry-run]
// بازیابی: ردیف‌ها از NDJSON (هر خط یک ردیف؛ Bufferها {"$b64":"…"}) با اسکریپتِ دلخواه یا INSERT؛ schema.sql ساختِ جداول است.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const require = createRequire(path.join(REPO, 'server', 'package.json'));
const mysql = require('mysql2/promise');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OUT = path.resolve(String(args.out || path.join(REPO, 'backups')));
const DATA_DIR = path.resolve(String(args['data-dir'] || path.join(REPO, 'server', 'data')));
const ONLY = args.only ? String(args.only).split(',').map((x) => x.trim()).filter(Boolean) : null;
const DRY = !!args['dry-run'];
const NO_FILES = !!args['no-files'];

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = process.env.FEELIA_ENV_FILE || path.join(REPO, 'server', '.env');
  const m = /^DATABASE_URL=(.*)$/m.exec(readFileSync(envFile, 'utf8'));
  if (!m) throw new Error('DATABASE_URL not found');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(OUT, stamp);
const conn = await mysql.createConnection({ uri: databaseUrl(), charset: 'utf8mb4', timezone: 'Z', dateStrings: true });
const manifest = { stamp, db: 'redacted', tables: {}, files: null, dry_run: DRY };

try {
  const [tr] = await conn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  let tables = tr.map((r) => Object.values(r)[0]);
  if (ONLY) tables = tables.filter((t) => ONLY.includes(t));
  if (!DRY) mkdirSync(dir, { recursive: true });
  let schema = '';
  for (const t of tables) {
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    manifest.tables[t] = { rows: Number(n), sha256: null };
    if (DRY) continue;
    const [cr] = await conn.query(`SHOW CREATE TABLE \`${t}\``);
    schema += cr[0]['Create Table'] + ';\n\n';
    const file = path.join(dir, `${t}.ndjson`);
    const out = createWriteStream(file);
    const hash = createHash('sha256');
    const CHUNK = 2000;
    for (let off = 0; off < Number(n); off += CHUNK) {
      const [rows] = await conn.query(`SELECT * FROM \`${t}\` LIMIT ${CHUNK} OFFSET ${off}`);
      for (const row of rows) {
        const line = JSON.stringify(row, (k, v) => (Buffer.isBuffer(v) ? { $b64: v.toString('base64') } : v)) + '\n';
        hash.update(line);
        if (!out.write(line)) await new Promise((r) => out.once('drain', r));
      }
    }
    await new Promise((r) => out.end(r));
    manifest.tables[t].sha256 = hash.digest('hex');
  }
  if (!DRY) writeFileSync(path.join(dir, 'schema.sql'), schema);

  // فایل‌ها: mirrorِ فقط‌افزودنی (هرگز حذف/بازنویسیِ فایلِ هم‌نام با اندازه‌یِ برابر)
  if (!NO_FILES) {
    const mirror = path.join(OUT, 'files-mirror');
    const stats = { copied: 0, skipped: 0, bytes: 0 };
    const walk = (src, dst) => {
      if (!existsSync(src)) return;
      for (const name of readdirSync(src)) {
        const s = path.join(src, name); const d = path.join(dst, name);
        const st = statSync(s);
        if (st.isDirectory()) { walk(s, d); continue; }
        if (existsSync(d) && statSync(d).size === st.size) { stats.skipped++; continue; }
        if (!DRY) { mkdirSync(path.dirname(d), { recursive: true }); cpSync(s, d, { force: true }); }
        stats.copied++; stats.bytes += st.size;
      }
    };
    for (const sub of ['session-audio', 'uploads', 'batch-queue']) walk(path.join(DATA_DIR, sub), path.join(mirror, sub));
    manifest.files = stats;
  }
  if (!DRY) writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const totalRows = Object.values(manifest.tables).reduce((a, t) => a + t.rows, 0);
  console.log(`${DRY ? '[dry-run] ' : ''}backup ${stamp}: ${Object.keys(manifest.tables).length} tables, ${totalRows} rows` + (manifest.files ? `, files copied=${manifest.files.copied} skipped=${manifest.files.skipped} bytes=${manifest.files.bytes}` : '') + (DRY ? '' : ` → ${dir}`));
} finally {
  await conn.end();
}
