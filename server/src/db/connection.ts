// اتصال به PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://feelia:feelia2025@localhost:5432/feelia',
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