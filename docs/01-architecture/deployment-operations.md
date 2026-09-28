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

**LLM در production (2026-09-28):** تا این تاریخ `.env`ِ زنده هیچ کلیدِ LLMی نداشت (تولیدِ پرونده هرگز کار نکرده بود). از deployِ `d0cbab7`: `LLM_PROVIDER=openrouter`، `OPENROUTER_API_KEY` (همان کلیدِ dev — اعتبارِ مشترک، مثلِ Soniox)، `OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash`. سقفِ توکن در کد (`FINAL_TRANSCRIPT_MAX_TOKENS`/`CASE_FILE_MAX_TOKENS`) است. بدونِ آن، OpenRouter با اعتبارِ کم 402 می‌دهد.

**سوییچِ providerِ LLM (از کدِ 2026-09-28، `server/src/llm/`) — اجرا شد 2026-09-28 (`233016e`): production = `LLM_PROVIDER=metis`، `METIS_MODEL=deepseek-v4-flash`؛ `FINAL_TRANSCRIPT_REASONING_EFFORT=off`ِ قبلی به `OPENROUTER_FINAL_TRANSCRIPT_REASONING_EFFORT=off` تغییرِ نام داد (فقط برایِ برگشت به Dots3ِ OpenRouter). backup: `/root/backups/code-pre-llm-layer-20260928T113646Z.tar.gz` و `env-pre-metis-20260928T113646Z`. روال:**
1. probeِ دسترسی از VPS: `curl -s -o /dev/null -w '%{http_code}' https://api.metisai.ir/deepseek/v1/models` ⇒ انتظار 401 (بدونِ کلید).
2. افزودن به `/root/feeliaa-mysql/.env` (کلید از stdinِ SSH، هرگز چاپ نشود): `METIS_API_KEY`، `METIS_MODEL=deepseek-v4-flash`، سپس `LLM_PROVIDER=metis`. کلید/مدلِ OpenRouter **بمانند** (برایِ rollback).
3. `FINAL_TRANSCRIPT_MODEL` و `FINAL_TRANSCRIPT_FALLBACK_MODELS`ِ فعلی مالِ OpenRouter‌اند و با متیس خودکار نادیده گرفته می‌شوند (هشدار در لاگِ شروع)؛ حذفشان لازم نیست.
4. restart ⇒ در لاگِ شروع دو خطِ `[llm] case-file: Metis model=deepseek-v4-flash json=object reasoning=low …` و `[llm] final-transcript: Metis … reasoning=low` دیده شود؛ خطِ «پیکربندی نامعتبر» یعنی env ناقص است.
5. **rollback:** `LLM_PROVIDER=openrouter` + restart. providerِ جدا برایِ هر مسیر: `CASE_FILE_LLM_PROVIDER` / `FINAL_TRANSCRIPT_LLM_PROVIDER`.

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
3. **Preflightِ اجباری — آیا کسی الان از سایت استفاده می‌کند؟** (بلافاصله قبل از گامِ ۴؛ فقط-خواندنی) — [§۵.۱](#۵۱-preflight-کاربرِ-فعال-قبل-از-restart).
   اگر NO-GO بود، restart نکنید؛ صبر و تکرار.
4. رویِ سرور: backup از DB اگر migrationِ داده‌تغییردهنده در راه است (migrationِ فقط-ADD-COLUMN معمولاً
   نیاز ندارد — همه‌ی migrationهایِ `mysql/migrations` تا امروز idempotent و برگشت‌پذیر با ستونِ NULL/DEFAULT بوده‌اند).
5. `tar -xzf` مستقیم داخلِ `/root/feeliaa-mysql` → `pnpm install --frozen-lockfile` → `pm2 restart feelia-mysql --update-env`.
6. لاگ را با `pm2 logs feelia-mysql --lines 40 --nostream` بررسی کنید — همه‌ی migrationهایِ جدید باید `applied` باشند، بدونِ خطا.
7. `curl -s http://localhost:3000/api/health` → `{"status":"ok","database":"connected"}`.
8. smoke: شروعِ یک جلسه‌ی آزمایشی **با داده‌ی غیرواقعی** (اگر تغییرِ لمس‌کننده‌ی مسیرِ رونویسی/صدا بود).

**وقتی نشستِ دیگری هم‌زمان در همان working tree کار می‌کند (2026-09-27):** تار را از working tree نسازید — کارِ نیمه‌تمام (و migrationِ
آن) به production می‌رود. به‌جایش `git worktree add --detach <scratch> <commit>` → فقط تغییراتِ همین کار → `pnpm install` + تست‌ها + build
در همان worktree → commit → تار از همان worktree. پیش از deploy، checksumِ کدِ production (`server/src`، `public`، lockfile، با حذفِ `\r`)
را با commitِ پایه مقایسه کنید تا معلوم شود deploy دقیقاً چه چیزی را عوض می‌کند. پشتیبانِ کدِ فعلی پیش از استخراج:
`/root/backups/code-pre-<name>-<ts>.tar.gz` (برگشت = استخراجِ همان تار + restart). نمونه: Event Logِ `PROJECT_STATUS.md`، 2026-09-27 (علائم در متن).

### ۵.۱ Preflight: کاربرِ فعال قبل از restart

**چرا:** در رونویسیِ زنده مرورگر مستقیم به Soniox وصل است؛ سرور فقط mintِ کلید و ذخیره‌ی دوره‌ایِ صدا/متن را می‌بیند.
پس «سرور بیکار به‌نظر می‌رسد» ≠ «کسی جلسه ندارد». restart وسطِ جلسه یا آپلود ریسکِ از دست رفتنِ تکه/وقفه دارد.
سیگنال‌ها از schemaِ واقعی: `sessions.status/updated_at`، `session_audio.created_at`، `audio_uploads`، `audio_jobs`
(migration 023)، `sessions.batch_status`، و رویدادِ `stt.mint_ok` در `obs_events` (`server/src/http/stt.ts`).

**اجرا** (همان الگویِ اسکریپتِ یک‌بارِ §۴.۱؛ فقط `COUNT` — هیچ متنِ بالینی/شناسه‌ای چاپ نمی‌شود؛ اسکریپت در پایان حذف می‌شود):

```bash
cd /root/feeliaa-mysql && cat > server/_preflight.mjs <<'EOF'
import 'dotenv/config';
import mysql from 'mysql2/promise';
const c = await mysql.createConnection({ uri: process.env.DATABASE_URL });
const [rows] = await c.query(`
  SELECT 'live_sessions' k, COUNT(*) v FROM sessions WHERE status='in_progress' AND updated_at > NOW() - INTERVAL 15 MINUTE
  UNION ALL SELECT 'audio_chunks_5m', COUNT(*) FROM session_audio WHERE created_at > NOW() - INTERVAL 5 MINUTE
  UNION ALL SELECT 'soniox_mint_10m', COUNT(*) FROM obs_events WHERE event='stt.mint_ok' AND ts > NOW() - INTERVAL 10 MINUTE
  UNION ALL SELECT 'uploads_active', COUNT(*) FROM audio_uploads WHERE status='uploading' AND updated_at > NOW() - INTERVAL 15 MINUTE
  UNION ALL SELECT 'jobs_running', COUNT(*) FROM audio_jobs WHERE stage NOT IN ('done','failed')
  UNION ALL SELECT 'batch_running', COUNT(*) FROM sessions WHERE batch_status IN ('queued','processing') AND updated_at > NOW() - INTERVAL 6 HOUR`);
await c.end();
const m = Object.fromEntries(rows.map(r => [r.k, Number(r.v)]));
console.table(m);
const hard = m.live_sessions + m.audio_chunks_5m + m.soniox_mint_10m + m.uploads_active;
const soft = m.jobs_running + m.batch_running;
console.log(hard ? 'NO-GO: کاربرِ فعال (جلسه/ضبط/آپلود) — صبر کنید'
  : soft ? 'WAIT: فقط jobِ پس‌زمینه در جریان است — ترجیحاً صبر کنید' : 'GO: کسی فعال نیست');
EOF
DOTENV_CONFIG_PATH=/root/feeliaa-mysql/.env node server/_preflight.mjs; rm -f server/_preflight.mjs
```

بلوکِ بالا برایِ اجرا **داخلِ shellِ سرور** است. از ماشینِ dev آن را داخلِ `ssh '...'` نگذارید (کوتیشن‌هایِ تکیِ اسکریپت می‌شکنند)؛
به‌جایش: `ssh -i ~/.ssh/feelia_migration root@185.110.191.126 'bash -s' <<'REMOTE'` + همان بلوک + `REMOTE` (تأییدشده 2026-09-26).

| خروجی | معنی | اقدام |
|---|---|---|
| `live_sessions` / `audio_chunks_5m` > 0 | جلسه‌ی زنده در حالِ ضبط | **NO-GO** |
| `soniox_mint_10m` > 0 | رونویسیِ زنده/یادداشتِ صوتی تازه شروع شده | **NO-GO** |
| `uploads_active` > 0 | آپلودِ فایلِ صوتی در جریان | **NO-GO** |
| `jobs_running` / `batch_running` > 0 | jobِ پس‌زمینه (lease/retry دارد، ولی restart آن را از نو شروع می‌کند) | **WAIT** — ترجیحاً صبر |
| همه ۰ | — | **GO** |

**چکِ تکمیلی (هر کاربرِ آنلاین، حتی بدونِ جلسه):** زمانِ آخرین خطوطِ لاگ — اگر چند دقیقه‌ی اخیر است، کسی در سایت است:
`pm2 logs feelia-mysql --lines 50 --nostream` و (مسیرِ **UNVERIFIED**، پیش‌فرضِ nginx) `tail -n 50 /var/log/nginx/access.log`.
همه‌ی GETهایِ عادی در `obs_events` ثبت نمی‌شوند (`server/src/obs/httpHook.ts` فقط خطا/کند/ادمین/mutationِ حسابرسی‌شده را به DB می‌فرستد)،
پس برایِ «حضورِ صرف» لاگ مرجع است نه DB.
مسیرِ لاگِ nginx تأیید شد (2026-09-26). **تفسیر:** یک تبِ باز حتی بیکار هر دقیقه `GET /api/notifications` و `/api/audio-jobs?scope=active`
می‌زند (~۲ درخواست/دقیقه) — این یعنی «کسی صفحه را باز دارد»، نه جلسه؛ restart برایش بی‌خطر است (polling بعد از بالا آمدن ادامه می‌یابد).
درخواست‌هایِ دیگر (`/api/sessions/...`، `/api/stt/...`، آپلود) نشانه‌ی کارِ واقعی‌اند.

**پنجره‌ی ۶ ساعته برایِ `batch_running`:** در اولین اجرا (2026-09-26) سه ردیفِ `batch_status='queued'` با عمرِ ۱۰۸ و ۳۳۹ ساعت پیدا شد —
همان باگِ «batch_statusِ گیرکرده» که رفعش در working tree است ولی deploy نشده؛ jobِ واقعی نیستند و بدونِ این فیلتر preflight همیشه WAIT می‌داد.

**وضعیت:** اولین اجرا رویِ production: 2026-09-26 — اسکریپت درست اجرا و حذف شد (Event Log).

**کشِ مرورگر:** فایل‌هایِ `public/` (بدونِ نسخه در URL) با `Cache-Control: no-cache` سرو می‌شوند (`server/src/index.ts`،
از ۲۰۲۶-۰۹-۲۳) تا هر بارگذاری revalidate شود (ETag → 304). پیش از آن پیش‌فرضِ `public, max-age=0` باعث شد مرورگرِ مالک
`feelia-rt.js`ِ پیش از دو deploy را اجرا کند. برایِ تأیید: `curl -skI --resolve feelia.ir:443:127.0.0.1 https://feelia.ir/feelia-rt.js`.
هر گام روی production نیازمندِ مجوزِ صریح است (LAW-006)؛ اولین اجرایِ کاملِ این رویه: Event Logِ
`PROJECT_STATUS.md`، ۲۰۲۶-۰۹-۲۳ (deployِ فیچرِ Case File + محدودسازیِ آن به یک تراپیست).

## ۶. عملیات

| موضوع | وضعیت |
|---|---|
| Health | `GET /api/health` → `{status: ok|degraded, database}` |
| تشخیصِ STT | `GET /api/stt/check` (نیازمندِ auth) — فقط mintِ آزمایشی (probeِ legacy 2026-09-24 حذف شد) |
| ابزارِ تشخیصِ read-only | `diag-collect.sh` (`--check-cookie`، `--soniox-egress`، شنودِ زنده) با mask کردنِ secretها |
| لاگ‌ها | stdout (Fastify JSON، `redact` روی کوکی/Authorization از فازِ ۱ِ رصد/حسابرسی، 2026-09-22 — `LOG_LEVEL`) + `console.log` با پیشوند؛ نگهداری/rotationِ stdout نامعلوم. **جدید:** `<cwd>/data/logs/obs.jsonl` — لاگِ ساختارمندِ همه‌ی رویدادهایِ obs (فایلِ دائمی، مستقل از DB)، چرخشِ اندازه‌محورِ دستی (بدونِ dependency، `obs/fileSink.ts`): هر فایل ≤۸MB، حداکثر ۵ فایلِ چرخیده (`obs.jsonl.1`..`.5`) → **سقفِ سختِ دیسک ~۴۸MB**. `data/` (شاملِ `data/logs/`) gitignored و هرگز commit نمی‌شود. |
| مانیتورینگ/alert | وجود ندارد |
| backup | در repo تعریف نشده |
| sweeperها | خودکار داخلِ پروسه (§ system-architecture)؛ **جدید:** `sweepOldObsEvents` هر ۲۴ساعت + startup (`obs/sweep.ts`) |
| scale | فقط یک instance (LAW-013) |

## ۷. CI/CD
وجود ندارد. تست‌ها دستی: `pnpm test:rt` و `npx tsc --noEmit`.
