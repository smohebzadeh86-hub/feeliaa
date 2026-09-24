# Deployment & Operations

> **وضعیت:** ACTIVE-CANONICAL · **Completeness: HAS-INFERRED** — در repo فایلِ Dockerfile، pm2 ecosystem یا CI نیست؛ فقط کانفیگِ مرجعِ nginx (`deploy/nginx/feelia.conf`، هنوز اعمال‌نشده). هر بخش با برچسبِ منبع مشخص است.
> آخرین بازبینیِ روی سرور: 2026-09-23 (SSH با کلید، §۴.۱).

## ۱. پیش‌نیازها

| مورد | منبع | وضعیت |
|---|---|---|
| Node.js با پشتیبانیِ ESM و top-level await | `server/package.json` (`"type":"module"`)، `index.ts` | نسخه pin نشده (بدونِ `engines`)؛ dev: v24.19.0 |
| pnpm (workspace) | `pnpm-workspace.yaml`، `pnpm-lock.yaml` | بدونِ `packageManager`؛ dev: 10.34.5 |
| MySQL 8.0.16+ (از 2026-09-15؛ PostgreSQL فقط تاریخی) | `server/src/db/connection.ts` (`mysql2`)، `server/src/db/mysql/schema.sql` | production: MySQL رویِ همان سرور (`localhost`)؛ نسخه‌ی دقیق بررسی نشد |
| ffmpeg در PATH یا `FFMPEG_PATH` | `stt/speakerResolve.ts`، remuxِ صدایِ جلسه | فقط برای resolve-speakers/remux؛ **رویِ production نصب نیست** (لاگِ `spawn ffmpeg ENOENT`، 2026-09-23 — fail-open) |
| HTTPS جلوی اپ | الزامِ getUserMedia (هشدارِ `maybeShowHttpsHint`) | UNVERIFIED |
| دسترسیِ خروجی به `api.soniox.com` (یا `PROXY_URL`) | `stt/*` | الزامی برای mint |

## ۲. محیطِ توسعه (تأییدشده از repo)

- `pnpm install` (root) سپس `pnpm dev` → `pnpm --filter server dev` → `tsx watch src/index.ts` با cwd = `server/`.
- `.env` از `server/.env`؛ `data/` در `server/data/` (gitignored).
- `.claude/launch.json`: `npm run dev` روی پورت 3000.
- پیش‌فرضِ `DATABASE_URL` در کد به یک MySQLِ محلی اشاره دارد (`server/src/db/connection.ts:7`؛ credential در کد — [configuration-catalog](../02-reference/configuration-catalog.md)).
- `CLARITY_PROJECT_ID` در dev ست نشود.

## ۳. Build و اجرا (تأییدشده از repo)

```bash
pnpm --filter server run build
```
= `tsc` (خروجی `server/dist/`) + `node scripts/copy-assets.mjs` (کپیِ `src/db/migrations` → `dist/db/migrations` و `src/db/mysql/migrations` → `dist/db/mysql/migrations`؛ `server/scripts/copy-assets.mjs:17-18`).

```bash
pnpm --filter server start
```
= `node dist/index.js`. فایل‌های استاتیک از `server/dist/../../public` = `public/` در ریشه‌ی repo → **فرانت و بک از یک checkout سرو می‌شوند**.

وابستگی‌های مسیر به cwd:
| چیز | مسیر |
|---|---|
| `.env` | `<cwd>/.env` |
| صف/آرشیوِ صدا | `<cwd>/data/…` |
| migrationها | اول `dist/db/mysql/migrations`، سپس `<cwd>/src/db/mysql/migrations`، سپس `<cwd>/server/src/db/mysql/migrations` (`server/src/db/migrate.ts:10-15`) |
| `public/` | نسبت به فایلِ `index.js` (مستقل از cwd) |

## ۴. Production — تأییدشده روی خودِ سرور (۲۰۲۶-۰۹-۲۳)

**C3 حل شد:** روی سرور (`185.110.191.126`) دو پروسه‌ی pm2 وجود دارد، نه یکی:

| پروسه | cwd | وضعیت (۲۰۲۶-۰۹-۲۳) | نکته |
|---|---|---|---|
| `feelia` | `/root/feeliaa` | **stopped** | یک git repo واقعی (branch `main`)؛ کدِ Postgresِ قدیمی/متروک؛ فقط برایِ مرجعِ تاریخی نگه‌داشته شده — **این production نیست.** |
| `feelia-mysql` | `/root/feeliaa-mysql` | **online، همان که واقعاً سرویس می‌دهد** | یک checkout بدونِ `.git` (کپیِ ساده، آپدیت با آپلودِ دستیِ tar + استخراج مستقیم روی همین مسیر، نه `git pull`)؛ `.env`ِ واقعی فقط `/root/feeliaa-mysql/.env` (`-rw-------`) است — کدِ برنامه `<cwd>/.env` را می‌خواند (جدولِ بخشِ ۳). نسخه‌ی کهنه‌ی `server/.env` (credentialِ DBِ نامعتبر، world-writable) در 2026-09-23 به `server/.env.stale-2026-09-23` (`chmod 600`) منتقل شد. |

nginx رویِ پورتِ ۳۰۰۰ به `feelia-mysql` وصل است (`ss -tlnp` تأیید کرد فقط یک پروسه‌ی node رویِ ۳۰۰۰ گوش می‌دهد).
`$HOME/server-deploy` (ادعایِ قدیمیِ `diag-collect.sh`) دیگر بررسی نشد — با دو پروسه‌ی بالا بی‌ربط به نظر می‌رسد.

| ادعا | منبع | اعتبار |
|---|---|---|
| دامنه `feelia.ir` | `docs/analytics-clarity.md`، کامنتِ `index.html` | EVIDENCE |
| `server-deploy/` محلی = کدِ `f9b0a9c` بدونِ فرانت | مقایسه‌ی فایل‌ها در [evidence](../../verification/2026-09-13-documentation-baseline.md) | EVIDENCE |

### ۴.۱ دسترسیِ SSH و عملیاتِ یک‌بارِ DB (تأییدشده 2026-09-23)

- **ورود:** فقط با کلیدِ اختصاصی روی ماشینِ dev (ویندوزِ مالک): `ssh -i ~/.ssh/feelia_migration root@185.110.191.126`.
  `ssh` بدونِ `-i` → `Permission denied (publickey,password)`؛ ورود با رمز توسطِ agent ممنوع است. کلید فقط روی همین ماشین است
  (ماشینِ دیگر/نشستِ ابری دسترسی ندارد). گاهی پورتِ ۲۲ `Connection timed out` می‌دهد — با `-o ConnectTimeout=30` دوباره امتحان کنید.
- **مجوز:** هر دستور رویِ production نیازمندِ مجوزِ صریحِ مالک در همان گفتگوست (LAW-006، `CLAUDE.md` §۶)؛ داشتنِ کلید مجوز نیست.
- **اسکریپتِ یک‌بارِ DB:** فایلِ `.mjs` موقت در `/root/feeliaa-mysql/server/` (تا `mysql2`/`dotenv` از `server/node_modules` resolve شوند)،
  اجرا از ریشه با `.env`ِ واقعی:
  ```bash
  cd /root/feeliaa-mysql && DOTENV_CONFIG_PATH=/root/feeliaa-mysql/.env node server/_script.mjs
  ```
  اسکریپت با `import 'dotenv/config'` و `mysql.createConnection({ uri: process.env.DATABASE_URL })` (همان الگویِ `connection.ts`).
  اول SELECTِ پیش‌بررسی، بعد تغییر با شرطِ محدود، بعد SELECTِ تأیید؛ در پایان اسکریپت حذف شود. هیچ secret یا متنِ بالینی چاپ نشود
  (برایِ مقایسه‌ی `.env`ها فقط hashِ کوتاه). نمونه: فعال‌سازیِ `case_file_enabled` — Event Logِ `PROJECT_STATUS.md`، 2026-09-23.
- **تشخیصِ پروسه‌ی زنده:** `pm2 jlist` → `pm_cwd`/`pm_exec_path`/`status` (فقط `feelia-mysql` online است).

**رویه‌یِ deployِ واقعی (تأییدشده، نه PROPOSED):** لوکال build می‌شود (`pnpm --filter server run build`) →
تارِ `server/ public/ package.json pnpm-lock.yaml pnpm-workspace.yaml` (بدونِ `.env`/`node_modules`/`data`)
با `scp` به سرور → `tar -xzf` مستقیم **داخلِ** `/root/feeliaa-mysql` (چون آرشیو هرگز شاملِ `.env`/`data`
نیست، extract جای‌گزینِ فقط فایل‌هایِ کد می‌شود، بدونِ لمسِ دیتا/سکرت) → `pnpm install --frozen-lockfile`
→ `pm2 restart feelia-mysql --update-env` (migrationهایِ جدید خودکار اجرا می‌شوند، لاگِ `[db] ✓` را ببینید).
جزئیاتِ کاملِ اولین اجرایِ این رویه: Event Logِ `PROJECT_STATUS.md`، ۲۰۲۶-۰۹-۲۳.

**پیامد:** cwdِ پروسه‌ی *زنده* `/root/feeliaa-mysql` است — `.env` و `data/` همان‌جا. قبل از هر
عملیاتِ ops رویِ production، حتماً با `pm2 jlist` وضعیتِ `online`/`stopped` را دوباره تأیید کنید؛
هیچ‌وقت فرض نکنید نامِ آشناتر (`feelia`) همان پروسه‌ی زنده است.

**کانفیگِ زنده‌ی nginx (خوانده‌شده با `nginx -T`، 2026-09-24):** `/etc/nginx/sites-enabled/feelia` — ۸۰→۳۰۱ به https؛ رویِ ۴۴۳ `client_max_body_size 50m` و یک `location /` با `proxy_pass http://127.0.0.1:3000`، هدرهایِ Upgrade/Connection، `proxy_read_timeout 300s`، `proxy_send_timeout 300s`؛ بدونِ gzip/هدرهایِ امنیتیِ کانفیگِ مرجع. برایِ آپلودِ صدا (تکه‌ی ۴MB، `complete` تا ۳۰۰ث) کافی است؛ تغییری داده نشد. نکته: regenerateِ پرونده (همگام تا ~۱۰ دقیقه) از ۳۰۰ث بیشتر است — UI با 504 polling می‌کند.

**کانفیگِ مرجعِ nginx:** [`deploy/nginx/feelia.conf`](../../deploy/nginx/feelia.conf) (2026-09-23) — کانفیگِ زنده‌ی سرور
هنوز خوانده نشده (تلاشِ قبلی بدونِ `-i` کلید رد شد؛ از 2026-09-23 با کلیدِ §۴.۱ دسترسی هست)؛ قبل از اعمال با `nginx -T` مقایسه و فقط بلوک‌هایِ لازم ادغام شود.
نکاتِ حیاتی: `proxy_read_timeout` ≥ ۶۶۰ث برایِ `POST /api/clients/:id/case-file/regenerate` (درخواستِ همگامِ چنددقیقه‌ای؛
پیش‌فرضِ ۶۰ث → 504 در حالی که سرور تولید را ادامه می‌دهد)، `client_max_body_size 12m` (اپ تا ۱۰MB)، gzip برایِ JS/JSON،
و **هرگز** `Permissions-Policy: microphone=()` یا `max-age` رویِ `*.js`/`index.html` (ضبط/کش را می‌شکند).

nginx باید WebSocket upgrade را برای `/ws/*` پشتیبانی کند (فقط مسیرِ legacy) و محدودیتِ حجمِ body برای آپلودِ سگمنت‌ها داشته باشد (پیش‌فرضِ `client_max_body_size` در nginx برابرِ 1m است — **INFERRED** از پیش‌فرضِ nginx، کانفیگِ واقعی نامعلوم). خودِ اپ هم فایلِ multipart بزرگ‌تر از **1MiB** را رد می‌کند (تأییدشده؛ [configuration-catalog](../02-reference/configuration-catalog.md)). سگمنتِ ۶۰ثانیه‌ای با 24kbps حدودِ ۱۸۰KB است، ولی اگر مرورگر `audioBitsPerSecond` را نپذیرد و recorder بدونِ bitrate ساخته شود، سگمنت ممکن است به این سقف نزدیک/بیشتر شود (**INFERRED**) — [platform plan](../06-platform/implementation-plan.md).

## ۵. استقرارِ یک نسخه (رویه‌یِ تأییدشده — بخشِ ۴ را ببینید، نه `git pull`)

از آن‌جا که `/root/feeliaa-mysql` گیت ندارد، رویه‌یِ deploy تارِ محلی + `scp` + استخراجِ مستقیم است
(کاملِ آن در بخشِ ۴). خلاصه:
1. لوکال build (`pnpm --filter server run build`) + تست (`pnpm test:rt`, `pnpm test:cf`, `tsc --noEmit`).
2. تارِ `server/ public/ package.json pnpm-lock.yaml pnpm-workspace.yaml` (بدونِ `.env`/`node_modules`/`data`؛
   قبل از ارسال تأیید کنید `.env` در آرشیو نیست) → `scp` به `/root/`.
3. رویِ سرور: backup از DB اگر migrationِ داده‌تغییردهنده در راه است (migrationِ فقط-ADD-COLUMN معمولاً
   نیاز ندارد — همه‌ی migrationهایِ `mysql/migrations` تا امروز idempotent و برگشت‌پذیر با ستونِ NULL/DEFAULT بوده‌اند).
4. `tar -xzf` مستقیم داخلِ `/root/feeliaa-mysql` → `pnpm install --frozen-lockfile` → `pm2 restart feelia-mysql --update-env`.
5. لاگ را با `pm2 logs feelia-mysql --lines 40 --nostream` بررسی کنید — همه‌ی migrationهایِ جدید باید `applied` باشند، بدونِ خطا.
6. `curl -s http://localhost:3000/api/health` → `{"status":"ok","database":"connected"}`.
7. smoke: شروعِ یک جلسه‌ی آزمایشی **با داده‌ی غیرواقعی** (اگر تغییرِ لمس‌کننده‌ی مسیرِ رونویسی/صدا بود).

**کشِ مرورگر:** فایل‌هایِ `public/` (بدونِ نسخه در URL) با `Cache-Control: no-cache` سرو می‌شوند (`server/src/index.ts`،
از ۲۰۲۶-۰۹-۲۳) تا هر بارگذاری revalidate شود (ETag → 304). پیش از آن پیش‌فرضِ `public, max-age=0` باعث شد مرورگرِ مالک
`feelia-rt.js`ِ پیش از دو deploy را اجرا کند. برایِ تأیید: `curl -skI --resolve feelia.ir:443:127.0.0.1 https://feelia.ir/feelia-rt.js`.
هر گام روی production نیازمندِ مجوزِ صریح است (LAW-006)؛ اولین اجرایِ کاملِ این رویه: Event Logِ
`PROJECT_STATUS.md`، ۲۰۲۶-۰۹-۲۳ (deployِ فیچرِ Case File + محدودسازیِ آن به یک تراپیست).

## ۶. عملیات

| موضوع | وضعیت |
|---|---|
| Health | `GET /api/health` → `{status: ok|degraded, database}` |
| تشخیصِ STT | `GET /api/stt/check` (نیازمندِ auth) — mint آزمایشی + probeِ legacy |
| ابزارِ تشخیصِ read-only | `diag-collect.sh` (`--check-cookie`، `--soniox-egress`، شنودِ زنده) با mask کردنِ secretها |
| لاگ‌ها | stdout (Fastify JSON، `redact` روی کوکی/Authorization از فازِ ۱ِ رصد/حسابرسی، 2026-09-22 — `LOG_LEVEL`) + `console.log` با پیشوند؛ نگهداری/rotationِ stdout نامعلوم. **جدید:** `<cwd>/data/logs/obs.jsonl` — لاگِ ساختارمندِ همه‌ی رویدادهایِ obs (فایلِ دائمی، مستقل از DB)، چرخشِ اندازه‌محورِ دستی (بدونِ dependency، `obs/fileSink.ts`): هر فایل ≤۸MB، حداکثر ۵ فایلِ چرخیده (`obs.jsonl.1`..`.5`) → **سقفِ سختِ دیسک ~۴۸MB**. `data/` (شاملِ `data/logs/`) gitignored و هرگز commit نمی‌شود. |
| مانیتورینگ/alert | وجود ندارد |
| backup | در repo تعریف نشده |
| sweeperها | خودکار داخلِ پروسه (§ system-architecture)؛ **جدید:** `sweepOldObsEvents` هر ۲۴ساعت + startup (`obs/sweep.ts`) |
| scale | فقط یک instance (LAW-013) |

## ۷. CI/CD
وجود ندارد. تست‌ها دستی: `pnpm test:rt` و `npx tsc --noEmit`.
