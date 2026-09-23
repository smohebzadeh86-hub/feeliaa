# 2026-09-23 — تستِ قطعِ اینترنتِ مالک رویِ production → hotfix

> Evidence (مشاهده در یک لحظه). رویدادِ مالک: `PROJECT_STATUS.md` §7، همین تاریخ.

## شواهدِ production (read-only؛ فقط UUID/اندازه/زمان — بدونِ محتوا)

- جلسه‌ی تست: `e78df1a5-2072-4b46-8c63-4d9983a57798`، run `mue4j5iljisipq`.
- `data/session-audio/e78df1a5-…/`: `000000.webm` 24171B هدرِ `1a45dfa3` · `000001` 1995B `409d8103` · `000002` 2120B `40ab8103` ·
  `000003` 1491B `40a98103` · `000004` 2313B `40ab8103` · `000005` 50434B `1a45dfa3` · `full.webm` 24174B (فقط سگمنتِ ۰).
- لاگِ pm2: seq1/seq2 (`purpose=transcript`) → `unrecoverable … reason=bad-container`؛ seq3/4 remux → «Invalid data».
- nginx: IPِ مالک آخرین `GET /feelia-rt.js` را 11:55:09 UTC زده؛ deployها 12:52 (race چرخش) و 13:12 (`d514111`)؛ بارگذاری‌هایِ
  13:01/13:08/13:13ِ `/` بدونِ هیچ درخواستی برایِ JS. هدرِ سرو‌شده: `cache-control: public, max-age=0`.
- `PATCH /api/auth/case-file-auto-generate` → 403 (13:15:06).

## تستِ harness

| تست | `HEAD:public/feelia-rt.js` | بعد از رفع |
|---|---|---|
| T21 اولین صدایِ WSِ تازه بعد از reconnect هدرِ container است | FAIL (`TAIL,HDRx`) | PASS (`HDRx`) |
| T22 rebaseِ 409 متنِ batchِ append‌شده + متنِ زنده‌ی تازه را نگه می‌دارد | FAIL (batch حذف شد) | PASS |
| T22b ذخیره‌هایِ بعدی متنِ batch را نگه می‌دارند | FAIL | PASS |

`pnpm test:rt` **55/55**، `pnpm test:cf` **108/108**، `cd server && npx tsc --noEmit` تمیز.

## دیگر بررسی‌ها

- Fastifyِ مستقل با همان گزینه‌هایِ `@fastify/static`: `/feelia-rt.js` و `/` → `200` + `cache-control=no-cache` + ETag؛ با
  `If-None-Match` → `304`.
- `maybeShowCaseFileAutoPrompt` (استخراج از `index.html`، اجرا در node): `{enabled:false, auto:null}` → بسته؛ `{true,null}` → باز؛ `{true,false}` → بسته.
- پس از deploy (از خودِ سرور، `--resolve feelia.ir:443:127.0.0.1`): هر دو URL `no-cache`؛ JS شاملِ `targetWs`/`persistedText`؛
  HTML شاملِ شرطِ `case_file_enabled`؛ `/api/health` ok؛ pid 56266.

## تست‌نشده

جلسه‌ی end-to-endِ واقعی با قطع/وصلِ اینترنت در مرورگر (نیازمندِ حساب و میکروفون) — مالک باید با یک refresh دوباره تست کند.
