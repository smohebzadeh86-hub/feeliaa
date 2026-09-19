# verification/ — Evidence

> **Evidence describes an observation at a point in time. Evidence is not automatically current truth.** (LAW-019)

- هر اجرای تست، بررسی، benchmark، audit یا بررسیِ production یک فایلِ جدیدِ `YYYY-MM-DD-<topic>.md`.
- فایل‌های قبلی ویرایش نمی‌شوند (فقط اصلاحِ غلطِ تایپی)؛ نتیجه‌ی جدید = فایلِ جدید.
- هر فایل باید: تاریخ، commit/وضعیتِ working tree، محیط، دستورِ دقیق، خروجیِ خام یا خلاصه‌ی دقیق، و محدودیت‌ها را داشته باشد.
- **هیچ داده‌ی بالینی، secret، کوکی یا شماره‌ی واقعی** (LAW-001).

| فایل | موضوع |
|---|---|
| [2026-09-13-documentation-baseline.md](2026-09-13-documentation-baseline.md) | baseline هنگامِ ساختِ مستندات: harness، typecheck، provenance `server-deploy/`، سقفِ multipart |
| [../docs/05-plans/ui-ux-audit-2026-09-14.md](../docs/05-plans/ui-ux-audit-2026-09-14.md) §2 | evidenceِ اجرای UI (2026-09-14) با mock backend و Sonioxِ جعلی: ۴۷ یافته با شاهدِ «اجرا/کد/محاسبه» و ستونِ production. evidence داخلِ سندِ برنامه قرار گرفته چون مالک یک فایل خواسته بود |
| [2026-09-14-ux-audit-runtime.md](2026-09-14-ux-audit-runtime.md) | اجرای UI با mock برای UX audit: شکستِ بی‌صدای ذخیره‌ی یادداشت، خروج در حالتِ FAILED با میکروفونِ live، متنِ خالیِ یادداشت‌ها در پرونده، موبایل، کیبورد، کنتراست |
| [2026-09-14-clarity-test-pass.md](2026-09-14-clarity-test-pass.md) | تستِ محلیِ Clarity (بدونِ deploy): typecheck/build، harness 29/6، static mask/allowlist، route inject 10/10، sandbox ِ `feelia-analytics.js` 41/41؛ کلیکِ واقعی و payloadِ Clarity تست نشده. نوشته‌شده توسطِ نشستِ دیگر |
