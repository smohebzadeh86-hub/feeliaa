// اجرای migrations — از فایل‌های SQL
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, testConnection } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Database connection failed');
  }

  // جدولِ ردیابیِ migrations
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await query(
      'SELECT name FROM _migrations WHERE name = $1',
      [file]
    );
    
    if (applied.rows.length > 0) {
      console.log(`[db] ✓ ${file} (already applied)`);
      continue;
    }

    console.log(`[db] → applying ${file}...`);
    const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
    await query(sql);
    await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(`[db] ✓ ${file} applied`);
  }
}