// اجرای migrations — از فایل‌های SQL/JS در server/src/db/mysql/migrations
// (قبلاً Postgres از server/src/db/migrations — مهاجرت به دستورِ صریحِ مالک، 2026-09-15)
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, testConnection, pool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsDir(): string {
  const candidates = [
    path.join(__dirname, 'mysql', 'migrations'),
    path.join(process.cwd(), 'src/db/mysql/migrations'),
    path.join(process.cwd(), 'server/src/db/mysql/migrations'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error(
    `[db] mysql migrations directory not found. Tried:\n - ${candidates.join('\n - ')}\n` +
    `If you run from dist/, make sure the build copied the .sql/.mjs files.`
  );
}

// MySQL (برخلافِ Postgres) از "CREATE INDEX IF NOT EXISTS" و
// "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" پشتیبانی نمی‌کند؛ idempotency (اجرایِ
// امنِ دوباره) با نادیده‌گرفتنِ همین خطاهای مشخص به‌دست می‌آید (جزئیات:
// server/src/db/mysql/migrations/README.md).
const IGNORABLE_ERRNOS = new Set([
  1060, // ER_DUP_FIELDNAME — ستون از قبل با ADD COLUMN وجود دارد
  1061, // ER_DUP_KEYNAME — ایندکس/کلید از قبل با همین نام وجود دارد
  1091, // ER_CANT_DROP_FIELD_OR_KEY — DROP CONSTRAINT روی چیزی که وجود ندارد
  3822, // ER_DUP_CHECK_CONSTRAINT
  3823, // ER_CHECK_CONSTRAINT_DUP_NAME (برخی نسخه‌های MySQL)
  3821, // ER_CHECK_CONSTRAINT_NOT_FOUND — DROP CHECK رویِ constraintی که قبلاً حذف شده (migration 023)
]);

async function runStatement(sql: string, file: string): Promise<void> {
  const trimmed = sql.trim();
  if (!trimmed) return;
  try {
    await query(trimmed);
  } catch (err: any) {
    if (err && IGNORABLE_ERRNOS.has(err.errno)) {
      console.log(`[db] ✓ ${file}: statement already applied (errno ${err.errno}), skipping`);
      return;
    }
    throw err;
  }
}

export async function runMigrations() {
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Database connection failed');
  }

  // جدولِ ردیابیِ migrations
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_migrations_name (name)
    )
  `);

  const migrationsDir = resolveMigrationsDir();
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') || f.endsWith('.mjs'))
    .sort();

  for (const file of files) {
    const applied = await query(
      'SELECT name FROM _migrations WHERE name = ?',
      [file]
    );

    if (applied.rows.length > 0) {
      console.log(`[db] ✓ ${file} (already applied)`);
      continue;
    }

    console.log(`[db] → applying ${file}...`);
    if (file.endsWith('.mjs')) {
      // migrationِ داده‌تغییردهنده‌ای که ریاضیِ procedural دارد (مثلِ 013، تبدیلِ
      // تاریخِ شمسی) — به‌جایِ SQLِ خام، تابعِ JSِ تست‌شده صدا زده می‌شود.
      const modPath = path.join(migrationsDir, file);
      const mod = await import(`file://${modPath.replace(/\\/g, '/')}`);
      const fnName = `migrate${file.match(/^(\d+)/)?.[1] ?? ''}`;
      const fn = mod[fnName];
      if (typeof fn !== 'function') {
        throw new Error(`[db] ${file}: expected export "${fnName}" not found`);
      }
      await fn(pool);
    } else {
      const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await runStatement(stmt, file);
      }
    }
    await query('INSERT INTO _migrations (name) VALUES (?)', [file]);
    console.log(`[db] ✓ ${file} applied`);
  }
}
