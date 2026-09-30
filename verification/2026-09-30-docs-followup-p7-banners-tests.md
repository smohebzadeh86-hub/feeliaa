# پیگیریِ پلنِ مستندات: تست‌هایِ رفتاری، `test:api`، فاز ۷ و bannerهایِ فرانت

- **تاریخ:** 2026-09-30 · **پایه:** `feat/clarity` @ `17d6919` + working treeِ مستندات · **مجوز:** مالک («همه رو انجام بده و commit کن»).

## تست‌هایِ رفتاری (پس از تغییرِ فقط-مستندات/tooling + commentهایِ index.html)
| دستور | نتیجه |
|---|---|
| `pnpm test:rt` | 102 PASS / 0 FAIL |
| `pnpm test:cf` | 111 PASS / 0 FAIL |
| `pnpm test:up` | 54 PASS / 0 FAIL |
| `pnpm test:tu` | 17 passed / 0 failed |
| `pnpm test:ft` | 59 pass / 0 fail |
| `pnpm test:llm` | 18 PASS / 0 FAIL |
| `FEELIA_E2E_OK=1 pnpm test:api` | exit 0؛ ۳۶۲ ورودی ضبط شد (بدون golden ⇒ مقایسه‌ای نبود)؛ fixtureها پاک شد (`remaining fixture-phone therapists: 0`)؛ Soniox mock، بدونِ کلیدِ LLM |
| `test:docs` / `test:arch` / `test:routes` / `tsc` | OK / OK / OK / exit 0 |

## فاز ۷
`PROJECT_STATUS.md`: ۲۸۶ ورودیِ Event Logِ تا 2026-09-28 و زنجیره‌ی قدیمیِ سربرگ **بدونِ ویرایش** به `docs/08-history/event-log-2026-09.md` منتقل شد (۵۰۳۴ ⇒ ~۵۳۰ خط). ۳۳ ورودیِ 09-29 و 09-30 ماند. `check-docs` این پوشه را از D3/D4 معاف می‌کند (لینک‌هایِ نسبت‌به‌ریشه‌ی متنِ تاریخی).

## bannerهایِ فرانت
۱۳ خطِ کامنتِ `// ===== [feature:<id>] =====` رویِ تابعِ ورودیِ هر feature در `public/index.html` (فقط ۱۳ خطِ افزوده؛ CRLF حفظ شد). syntaxِ `<script>` با `new Function` سالم؛ `test:rt` سبز. `check-docs` D12 وجودشان را می‌سنجد. **تستِ بصریِ مرورگر انجام نشد** (تغییر فقط کامنت است).

## محدودیت
`test:api` بدونِ golden اجرا شد؛ فقط «بدونِ خطا» و ضبط را ثابت می‌کند، نه عدمِ تغییرِ رفتار.
