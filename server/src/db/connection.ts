// اتصال به MySQL (قبلاً PostgreSQL — مهاجرت به دستورِ صریحِ مالک، 2026-09-15؛
// جزئیاتِ تصمیم‌های ترجمه‌ی دیالکت در server/src/db/mysql/schema.sql).
import mysql from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2';

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL || 'mysql://feelia:feelia2025@localhost:3306/feelia',
  charset: 'utf8mb4',
  // ⭐ معادلِ `-c client_encoding=UTF8`ِ نسخه‌ی Postgres (LAW-021) — بدونِ این، متنِ
  // فارسی در بعضی نصب‌های MySQL ممکنه با charsetِ latin1/غیرِutf8mb4 ذخیره بشه.
  // timezone:'Z' یعنی مقادیرِ DATETIME همیشه به‌عنوانِ UTC خونده/نوشته می‌شن —
  // معادلِ رفتارِ TIMESTAMPTZِ Postgres (که همیشه instant رو در UTC نگه می‌داشت).
  timezone: 'Z',
  // BOOLEAN/JSON در MySQL به‌ترتیب TINYINT(1)/متنِ JSON خام برمی‌گردن؛ اینجا به همون
  // شکلی که کدِ فعلی از دورانِ Postgres انتظار داره (JS boolean واقعی، JS object) تبدیل می‌شن.
  typeCast(field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      const v = field.string();
      return v === null ? null : v === '1';
    }
    if (field.type === 'JSON') {
      // بدونِ آرگومانِ encoding، mysql2 ستونِ JSON را باینری تفسیر می‌کند (هشدارِ خودِ
      // درایور) — 'utf8' صریح برایِ رمزگشاییِ درستِ متنِ فارسیِ داخلِ anchors لازم است.
      const v = field.string('utf8');
      return v === null ? null : JSON.parse(v);
    }
    return next();
  },
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const [result] = await pool.query(text, params as unknown[]);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.log(`[db] slow query (${duration}ms):`, text.slice(0, 60));
  }
  // SELECT → آرایه‌ی ردیف‌ها؛ INSERT/UPDATE/DELETEِ بدونِ RETURNING (که در MySQL
  // اصلاً وجود ندارد) → ResultSetHeader. call siteهای فعلی همه با `.rows` کار
  // می‌کنن (میراثِ pg) — این wrapper همون شکل رو حفظ می‌کنه تا نیازی به تغییرِ
  // همه‌ی خواننده‌ها نباشه؛ `.rowCount` برایِ چکِ «آیا چیزی مچ شد» بعدِ UPDATE/DELETE اضافه شده.
  if (Array.isArray(result)) {
    return { rows: result as any[], rowCount: result.length };
  }
  const header = result as ResultSetHeader;
  return { rows: [] as any[], rowCount: header.affectedRows ?? 0 };
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

// برایِ کدی که نیازمندِ تراکنشِ چندعملیاتی است (مثلِ ساختِ اتمیکِ جلسه‌ی دستی +
// یادداشتِ همراهش) — چون MySQL برخلافِ Postgres از CTEِ نویسنده (INSERT درونِ WITH)
// پشتیبانی نمی‌کند؛ آن الگو با pool.getConnection()/beginTransaction بازنویسی شده.
export { pool };
export default pool;
