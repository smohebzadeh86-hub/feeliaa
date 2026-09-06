// اتصال به PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://feelia:feelia2025@localhost:5432/feelia',
  // ⭐ برنامه کاملاً فارسیه — بدون این، بعضی سرورهای Postgres (بسته به locale سیستمی که
  // روشون initialize شدن) client_encoding رو چیزی غیر از UTF8 (مثل WIN1252) فرض می‌کنن
  // و هر متنِ فارسی توی INSERT/UPDATE با خطای «character has no equivalent» رد می‌شه.
  // این باید همون لحظه‌ی startup اعمال بشه (نه بعد از connect)، وگرنه با کوئریِ اول race می‌کنه.
  options: '-c client_encoding=UTF8',
});

// ⭐ بدون این، خطای یک کانکشنِ idle (مثلاً قطعی موقت دیتابیس) کل پروسه‌ی Node رو
// کرش می‌ده و همه‌ی جلسات فعال رو قطع می‌کنه — این مستندات خود node-postgres است.
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client:', err.message);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params as never[]);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.log(`[db] slow query (${duration}ms):`, text.slice(0, 60));
  }
  return result;
}

export async function testConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (e) {
    console.error('[db] connection failed:', (e as Error).message);
    return false;
  }
}

export default pool;