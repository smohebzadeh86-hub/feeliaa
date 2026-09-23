# Verification — مقایسه‌ی working tree (شاخه‌ی `feat/clarity`) با production — 2026-09-23

## روش

- SSH به `root@185.110.191.126` با paramiko (اسکریپتِ موقت در scratchpad نشست، پسورد در هیچ فایلِ commit‌شده ذخیره نشد).
- `pm2 jlist` → پروسه‌ی `feelia` با `pm_cwd=/root/feeliaa`، پروسه‌ی `feelia-mysql` با `pm_cwd=/root/feeliaa-mysql`.
- در `/root/feeliaa`: `git rev-parse HEAD` → `fed8b3b311b3bfd84a7490f822c1d69a1348b330`، `git branch --show-current` → `main`،
  `git status --porcelain` → فقط `?? server/real_retry.mjs` (untracked، اسکریپتِ دستیِ retry — بی‌ضرر).
- `tar --exclude=node_modules --exclude=.git --exclude=data --exclude='*.env'` از `server/ public/ package.json pnpm-lock.yaml pnpm-workspace.yaml scripts/` گرفته و به لوکال (`sftp.get`) منتقل شد؛ فایلِ tar موقت روی سرور بعدش حذف شد. **هیچ `.env` یا `data/` منتقل نشد.**
- `diff -rq` بینِ snapshotِ سرور و working tree لوکال برایِ `server/src`، `public/`، `package.json`، `scripts/rt-harness.cjs`.

## یافته‌ها

### فایل‌ها/دایرکتوری‌هایی که فقط در working tree لوکال هستند (روی سرور نیستند)
- `server/src/features/**` — کاملِ فیچرِ AI Case File (backend).
- `server/src/db/mysql/schema.sql` — مایگریشنِ MySQL.
- `server/src/http/obs.ts`, `server/src/ws/` (obs/transcription/p1 telemetry جدید), `public/feelia-obs.js` — لایه‌ی observability.
- `pnpm-workspace.yaml`: local دارد `test:cf` (`case-file-harness.ts`) که روی سرور نیست.

### فایل‌های مشترکِ با تفاوتِ محتوایی قابل‌توجه (تعداد خط، snapshot سرور ⟶ working tree لوکال)
| فایل | سرور | لوکال |
|---|---|---|
| `public/index.html` | 4652 | 6734 |
| `public/feelia-rt.js` | 1293 | 1597 |
| `public/feelia-analytics.js` | 288 | 232 (لوکال کوچک‌تر — تغییرِ ساختاری، نه فقط افزودن) |
| `server/src/http/admin.ts` | 292 | 669 |
| `server/src/http/sessions.ts` | 563 | 728 |
| `server/src/http/auth.ts` | 161 | 203 |
| `server/src/http/clients.ts` | 257 | 305 |
| `server/src/index.ts` | 77 | 121 |
| `server/src/stt/batchqueue.ts` | 251 | 372 |
| `server/src/stt/sessionAudioArchive.ts` | 93 | 342 |

فایل‌هایِ زیر هم متفاوت‌اند ولی بررسیِ عمیق‌ترِ محتوا در این پاس انجام نشد (فقط `diff -rq` تشخیصِ تفاوت داد):
`server/src/auth/session.ts`, `db/connection.ts`, `db/migrate.ts`, `db/ownership.ts`, `http/clientConfig.ts`,
`http/sessionDate.ts`, `http/stt.ts`, `stt/soniox.ts`.

### مایگریشن‌های SQL (001–003) — بررسیِ ویژه
`diff -rq` این‌ها را «differ» علامت زد، اما diff محتوایی نشان داد تفاوت فقط **line-ending** (CRLF/LF) است، نه
تفاوتِ schema. مایگریشن‌های ۰۰۴ تا ۰۱۴ در دو طرف identical به نظر رسیدند (بدونِ اختلاف در `diff -rq`).
مایگریشنِ MySQL (`server/src/db/mysql/schema.sql`) اصلاً روی سرور وجود ندارد — یعنی cutoverِ MySQL که در
Event Log ثبت شده (۲۰۲۶-۰۹-۱۶) روی یک checkout/سرورِ دیگر (`feelia-mysql`, pm2 process جدا) انجام شده، نه در
همین مسیرِ `/root/feeliaa` که این audit بررسی کرد.

### `package.json` (ریشه)
تنها تفاوت: لوکال یک اسکریپتِ اضافه دارد: `"test:cf": "pnpm --filter server exec tsx ../scripts/case-file-harness.ts"`.

### `scripts/rt-harness.cjs`
لوکال ~۳۰ سطر تستِ اضافه دارد (mock IndexedDB + سناریوهایِ T18/T19/T19b برایِ reconnect/watchdog) که روی سرور نیست.

## نتیجه‌گیری

Production (`/root/feeliaa`, commit `fed8b3b3`, branch `main`) یک نسخه‌ی **به‌مراتب قدیمی‌تر** از working tree
فعلی است. کارهایی که deploy نشده‌اند شاملِ کلِ فیچرِ AI Case File، لایه‌ی observability جدید، و بخشِ عمده‌ای از
سختی‌گیری‌های stt/session است. این یک یافته‌ی صرفاً اطلاعاتی است؛ هیچ تصمیمی درباره‌ی deploy گرفته یا اجرا نشد.

## عدمِ دسترسی/محدودیت‌ها
- محتوایِ `.env` روی سرور خوانده یا منتقل نشد (secret).
- `node_modules` و `data/` منتقل نشدند (حجم/PII).
- بررسیِ ریزِ diff خطِ‌به‌خط برایِ همه‌ی فایل‌هایِ فهرست‌شده در جدولِ «بررسیِ عمیق‌تر انجام نشد» صورت نگرفت —
  اگر لازم شد، در یک پاسِ جدا قابلِ انجام است.
