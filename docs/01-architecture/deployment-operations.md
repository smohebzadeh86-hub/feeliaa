# Deployment & Operations

> **وضعیت:** ACTIVE-CANONICAL · **Completeness: HAS-INFERRED** — هیچ فایلِ استقرار (Dockerfile، pm2 ecosystem، nginx conf، CI) در repo نیست. هر بخش با برچسبِ منبع مشخص است.

## ۱. پیش‌نیازها

| مورد | منبع | وضعیت |
|---|---|---|
| Node.js با پشتیبانیِ ESM و top-level await | `server/package.json` (`"type":"module"`)، `index.ts` | نسخه pin نشده (بدونِ `engines`)؛ dev: v24.19.0 |
| pnpm (workspace) | `pnpm-workspace.yaml`، `pnpm-lock.yaml` | بدونِ `packageManager`؛ dev: 10.34.5 |
| PostgreSQL با `gen_random_uuid()` (PG ≥13 یا pgcrypto) | migrationها | نسخه‌ی production نامعلوم |
| ffmpeg در PATH یا `FFMPEG_PATH` | `stt/speakerResolve.ts` | فقط برای resolve-speakers |
| HTTPS جلوی اپ | الزامِ getUserMedia (هشدارِ `maybeShowHttpsHint`) | UNVERIFIED |
| دسترسیِ خروجی به `api.soniox.com` (یا `PROXY_URL`) | `stt/*` | الزامی برای mint |

## ۲. محیطِ توسعه (تأییدشده از repo)

- `pnpm install` (root) سپس `pnpm dev` → `pnpm --filter server dev` → `tsx watch src/index.ts` با cwd = `server/`.
- `.env` از `server/.env`؛ `data/` در `server/data/` (gitignored).
- `.claude/launch.json`: `npm run dev` روی پورت 3000.
- پیش‌فرضِ `DATABASE_URL` در کد به یک PostgreSQLِ محلی اشاره دارد (credential در کد — [configuration-catalog](../02-reference/configuration-catalog.md)).
- `CLARITY_PROJECT_ID` در dev ست نشود.

## ۳. Build و اجرا (تأییدشده از repo)

```bash
pnpm --filter server run build
```
= `tsc` (خروجی `server/dist/`) + `node scripts/copy-assets.mjs` (کپیِ `src/db/migrations` → `dist/db/migrations`).

```bash
pnpm --filter server start
```
= `node dist/index.js`. فایل‌های استاتیک از `server/dist/../../public` = `public/` در ریشه‌ی repo → **فرانت و بک از یک checkout سرو می‌شوند**.

وابستگی‌های مسیر به cwd:
| چیز | مسیر |
|---|---|
| `.env` | `<cwd>/.env` |
| صف/آرشیوِ صدا | `<cwd>/data/…` |
| migrationها | اول `dist/db/migrations`، سپس `<cwd>/src/db/migrations`، سپس `<cwd>/server/src/db/migrations` |
| `public/` | نسبت به فایلِ `index.js` (مستقل از cwd) |

## ۴. Production — ادعاهای موجود (UNVERIFIED)

| ادعا | منبع | اعتبار |
|---|---|---|
| دامنه `feelia.ir` | `docs/analytics-clarity.md`، کامنتِ `index.html` | EVIDENCE |
| pm2 با نامِ `feelia`، cwd `/root/feeliaa`، `.env` در `/root/feeliaa/.env`، restart با `pm2 restart feelia --update-env` | `docs/analytics-clarity.md` §4 | EVIDENCE |
| nginx جلوی اپ روی پورت 3000 | `diag-collect.sh` (بررسیِ `nginx -T`، `:3000`) | EVIDENCE |
| مسیرِ اپ `$HOME/server-deploy` | پیش‌فرضِ `diag-collect.sh` | EVIDENCE — **با ادعای pm2 تعارض دارد (C3)** |
| `server-deploy/` محلی = کدِ `f9b0a9c` بدونِ فرانت | مقایسه‌ی فایل‌ها در [evidence](../../verification/2026-09-13-documentation-baseline.md) | EVIDENCE |

**پیامد:** اگر cwd پروسه ریشه‌ی repo باشد، `.env` و `data/` در ریشه‌اند؛ اگر `server/` یا `server-deploy/` باشد، همان‌جا. قبل از هر عملیاتِ ops، cwd واقعیِ پروسه را روی سرور تأیید کنید.

nginx باید WebSocket upgrade را برای `/ws/*` پشتیبانی کند (فقط مسیرِ legacy) و محدودیتِ حجمِ body برای آپلودِ سگمنت‌ها داشته باشد (پیش‌فرضِ `client_max_body_size` در nginx برابرِ 1m است — **INFERRED** از پیش‌فرضِ nginx، کانفیگِ واقعی نامعلوم). خودِ اپ هم فایلِ multipart بزرگ‌تر از **1MiB** را رد می‌کند (تأییدشده؛ [configuration-catalog](../02-reference/configuration-catalog.md)). سگمنتِ ۶۰ثانیه‌ای با 24kbps حدودِ ۱۸۰KB است، ولی اگر مرورگر `audioBitsPerSecond` را نپذیرد و recorder بدونِ bitrate ساخته شود، سگمنت ممکن است به این سقف نزدیک/بیشتر شود (**INFERRED**) — [platform plan](../06-platform/implementation-plan.md).

## ۵. استقرارِ یک نسخه (روالِ پیشنهادی — PROPOSED، تأییدنشده)

1. commit و push روی branch (تا `54a17fd` انجام شده)؛ merge به `main` هنوز نشده — `origin/main` عقب‌تر از `feat/clarity` است (R3).
2. روی سرور: backup از DB (به‌ویژه قبل از migrationِ داده‌تغییردهنده‌ی 009 و 013).
3. pull → `pnpm install --frozen-lockfile` → `pnpm --filter server run build`.
4. restart (pm2) — migrationها خودکار اجرا می‌شوند؛ لاگِ `[db] ✓` را ببینید.
5. `GET /api/health` → `status:"ok"`؛ `GET /api/stt/check` (با نشستِ تراپیست) → `code:"mint-ok"`.
6. smoke: شروعِ یک جلسه‌ی آزمایشی **با داده‌ی غیرواقعی**.
هر گام روی production نیازمندِ مجوزِ صریح است (LAW-006).

## ۶. عملیات

| موضوع | وضعیت |
|---|---|
| Health | `GET /api/health` → `{status: ok|degraded, database}` |
| تشخیصِ STT | `GET /api/stt/check` (نیازمندِ auth) — mint آزمایشی + probeِ legacy |
| ابزارِ تشخیصِ read-only | `diag-collect.sh` (`--check-cookie`، `--soniox-egress`، شنودِ زنده) با mask کردنِ secretها |
| لاگ‌ها | stdout (Fastify JSON + `console.log` با پیشوند)؛ نگهداری/rotation نامعلوم |
| مانیتورینگ/alert | وجود ندارد |
| backup | در repo تعریف نشده |
| sweeperها | خودکار داخلِ پروسه (§ system-architecture) |
| scale | فقط یک instance (LAW-013) |

## ۷. CI/CD
وجود ندارد. تست‌ها دستی: `pnpm test:rt` و `npx tsc --noEmit`.
