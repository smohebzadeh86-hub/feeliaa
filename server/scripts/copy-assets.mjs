// Build step: copy non-TS assets (SQL migrations, ...) into dist/
// tsc فقط فایل‌های .ts را کامپایل می‌کند و بقیه (مثل .sql) را کپی نمی‌کند،
// در حالی که کد production در dist/ به آن‌ها نیاز دارد.
// این اسکریپت عمداً فقط با API خود Node نوشته شده تا روی
// Windows / Linux / macOS و داخل Docker بدون هیچ وابستگی کار کند.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// [from, to] — هر دو نسبی به پوشه‌ی server/
// ⭐ فیکسِ باگِ واقعی (کشف‌شده در deployِ ۲۰۲۶-۰۹-۲۳): فقط migrationهایِ قدیمیِ Postgres
// کپی می‌شد، نه migrationهایِ فعلیِ MySQL — یعنی یک deployِ فقط-dist (بدونِ server/src)
// اصلاً پیدایشان نمی‌کرد و resolveMigrationsDirِ migrate.ts خطا می‌داد.
const ASSETS = [
  ['src/db/migrations', 'dist/db/migrations'],
  ['src/db/mysql/migrations', 'dist/db/mysql/migrations'],
];

let copied = 0;
for (const [from, to] of ASSETS) {
  const src = path.join(serverDir, from);
  const dest = path.join(serverDir, to);
  if (!existsSync(src)) {
    console.error(`[build] ✗ missing asset source: ${src}`);
    process.exit(1);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  copied++;
  console.log(`[build] ✓ assets: ${from} -> ${to}`);
}
console.log(`[build] done (${copied} asset group(s))`);
