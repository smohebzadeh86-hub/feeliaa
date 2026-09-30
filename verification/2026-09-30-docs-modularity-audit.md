# Audit: مستندات و ماژولاریتی (فاز ۰ از پلنِ «تکمیلِ مستندات و قانون‌مند کردنِ ساختارِ ماژولار»)

- **تاریخ:** 2026-09-30 · **شاخه/commit:** `feat/clarity` @ `17d6919` · **نوع:** فقط‌خواندنی + baseline (LAW-019: مشاهده در یک لحظه، نه حقیقتِ فعلی)
- **محیط:** dev (Windows)، بدونِ DB/شبکه/production.

## Baseline (اجرا شد)
| دستور | نتیجه |
|---|---|
| `pnpm test:arch` | `backend boundaries OK (140 files, 348 static imports, no cycles)` |
| `pnpm test:routes` | `route snapshot OK (127 routes)` (هشدارِ fastify درباره‌ی `disableRequestLogging` — از قبل موجود) |
| `cd server && npx tsc --noEmit` | بدونِ خطا (exit 0) |

## یافته‌هایِ آغازین (خلاصه؛ از بازخوانیِ working tree)
**۱. drift مستندات**
- `CLAUDE.md` و `PROJECT_MASTER_REFERENCE.md`: PostgreSQL/۶ جدول/۷ ماژول (واقعیت: MySQL، ۲۰ جدول، migration تا 034، ۹ ماژول).
- `data-architecture.md` منسوخ (ER ۵ جدولی، claimهایِ غلط دربارهٔ status و صدایِ یتیم)؛ `database-catalog.md`: ۷ جدولِ بی‌بخش (`audit_log`، `client_members`، `tu_*`، `final_transcripts`)، ۸ ستونِ جاافتاده، CHECKِ `sessions.source` غلط.
- `documentation-map.md` منجمد در 09-13؛ `route-map.md` ۹ صفحه از ۱۶؛ `application-architecture.md` اندازه‌ی فرانت ≈۳۶۴۰ (واقعی ≈۹۶۰۰) و دو فایلِ JS جاافتاده؛ `integration-architecture.md` بدونِ egressِ LLM؛ `error-code-catalog.md` ادعایِ غلطِ «1MiB» و ≥۵ کدِ جاافتاده؛ `migrations/README.md` می‌گفت runner وصل نیست.
- مسیرهایِ پیش از refactor (`batchqueue.ts`، `sessionAudioArchive.ts`، …) در ≈۱۵ سند؛ برچسبِ «commitنشده» رویِ کدِ commit‌شده در چندین کاتالوگ.
- سطحِ route در `api-catalog`: ۸۵/۸۵ سالم؛ envهایِ runtime همه مستند.

**۲. ماژولاریتی**
- Backend در سطحِ import تمیز است و `test:arch` آن را می‌سنجد؛ ولی **هیچ LAWای برایِ ماژولاریتی نبود**، `llm/` در R2 نبود، layering فقط case-file، ۴ feature بدونِ `index.ts` (`admin`، `auth`، `client-config`، `legacy-ws`).
- داده: `sessions` را ۴+ featureِ دیگر با SQLِ مستقیم می‌نویسند؛ ساختِ جلسه در `audio-upload/uploadSession.ts` تکرار شده.
- فرانت: `public/index.html` یک اسکریپتِ ≈۷۸۰۰خطیِ global (≈۴۵۷ تابع) بدونِ قانونِ ساختاری.

**۳. سندِ فیچر**
- بدونِ سندِ مالک: treatment-unit، لایه‌ی LLM، observability/audit، notifications، session-media؛ case-file بدونِ implementation plan/REQ؛ template/رجیستری/محلِ ثبتِ تصمیم نبود؛ REQ-060/061 دو بار تخصیص یافته بود.

## نتیجه
پلنِ اجرا شد؛ نتیجه‌ی هر فاز: [2026-09-30-docs-phases-1-6.md](2026-09-30-docs-phases-1-6.md).

## محدودیت‌ها
این فایل فقط خلاصه است؛ فهرستِ خط‌به‌خطِ drift در پلنِ اصلی (نشستِ 2026-09-30) بود و در سندهایِ مالک اصلاح شد.
