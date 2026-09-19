# Evidence — Documentation Baseline (2026-09-13)

> **Status:** EVIDENCE · مشاهده در یک لحظه؛ حقیقتِ فعلی نیست.

## محیط
| مورد | مقدار |
|---|---|
| ماشین | dev (Windows 11، Git Bash) |
| Node / pnpm / npm | v24.19.0 / 10.34.5 / 11.17.0 |
| branch | `feat/clarity` (هم‌commit با `main` = `17dd11a`، 2026-09-12) |
| working tree | ۱۱ فایلِ modified (`public/feelia-rt.js`، `public/index.html`، `server/src/auth/guard.ts`، `http/admin.ts`، `http/auth.ts`، `http/clients.ts`، `http/sessions.ts`، `http/stt.ts`، `index.ts`، `stt/batchqueue.ts`، `stt/soniox.ts`)؛ untracked شاملِ migrationهای 008–011، `clientConfig.ts`، `asyncTranscribe.ts`، `sessionAudioArchive.ts`، `speakerResolve.ts`، `feelia-analytics.js`، `docs/analytics-clarity.md` |
| `git diff --stat` | 1655 insertions، 315 deletions در ۱۱ فایل |

## 1. Typecheck سرور
```
cd server && npx tsc --noEmit
```
نتیجه: exit 0، بدونِ خروجی.

## 2. Harness موتورِ realtime — working tree
```
node scripts/rt-harness.cjs
```
نتیجه: exit 1 · **29 PASS / 6 FAIL** از 35.

FAILها:
```
FAIL T2 unreliable -> batch fallback — batch
FAIL T15 note uploaded with purpose=note
FAIL T15 retry endpoint works — {"error":"صوتی در صف نیست"}
FAIL T15 note drain becomes session note, transcript still clean — []
FAIL T16 durable-only finish → batch-pending, queued — batch-pending
FAIL T16 later batch merges
```

## 3. Harness روی `feelia-rt.js` نسخه‌ی HEAD
روش: `git show HEAD:public/feelia-rt.js` و کپیِ `scripts/rt-harness.cjs` در یک پوشه‌ی scratchpad (خارج از repo)، اجرا با همان Node.
نتیجه: exit 0 · **35 PASS / 0 FAIL**.

**نتیجه‌گیری:** شکست‌ها با تغییراتِ commitنشده‌ی `feelia-rt.js` آمده‌اند. علتِ محتمل (INFERRED، با stub تأیید نشده): صفِ durable اکنون در IndexedDB است (`AudioQueueDB`) و Node/harness `indexedDB` ندارد → `add()` false → هیچ سگمنتی آپلود نمی‌شود. `grep -c indexedDB scripts/rt-harness.cjs` = 0.

## 4. Provenance ِ `server-deploy/`
مقایسه‌ی ۱۲ فایلِ `server-deploy/src` با `git show <rev>:server/src/...` (نادیده‌گرفتنِ CRLF):
- با `f9b0a9c`: همه یکسان.
- با `HEAD`: همه یکسان بجز `stt/soniox.ts` (تغییرِ commitهای `7f7a80c`/`17dd11a`).
- فاقدِ فایل‌های untrackedِ جدید و فاقدِ `public/`.
- شاملِ `.env` (کلیدها: `DATABASE_URL`، `SONIOX_API_KEY`، `AUTH_PASSWORD`، `PORT`، `#PROXY_URL`، `ADMIN_PHONE` — مقادیر خوانده/چاپ نشد).
نتیجه: کپیِ قدیمیِ کد؛ ارتباطش با production **UNVERIFIED**.

## 5. سقفِ multipart
- `server/node_modules/@fastify/multipart/package.json`: `"version": "10.1.1"`.
- `index.js:53`: `fileSize: options.limits?.fileSize || fastify.initialConfig.bodyLimit`.
- `server/src/index.ts`: `Fastify({ logger: true })` و `app.register(multipart)` بدونِ options → `bodyLimit` پیش‌فرضِ Fastify (1MiB).

## 6. grepهای کلیدی
| جستجو | نتیجه |
|---|---|
| `AUTH_PASSWORD` در `server/src` | استفاده ندارد |
| `global-agent` در `server/src` | استفاده ندارد |
| `voice-note` در `public/` | مصرف‌کننده‌ی HTTP ندارد |
| `DIAG-TEMP` در `HEAD:server/src/http/sessions.ts` | 0 (فقط در working tree) |
| متنِ «صدا هیچ‌جا ذخیره نمی‌شود» | در HEAD و working tree موجود |

## محدودیت‌ها
- هیچ تستِ runtime روی سرور/DB/مرورگر انجام نشد.
- production بررسی نشد.
- ادعاهای INFERRED در اسناد (فایل‌های یتیم، race در batch، seqِ تکراری در آرشیو) با اجرا تأیید نشده‌اند.
