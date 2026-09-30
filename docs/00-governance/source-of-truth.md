# Source of Truth — حلِ تعارض بینِ منابع

> **وضعیت:** ACTIVE · **اعتبار:** HIGH · مرتبط: [LAW-018](project-laws.md#law-018--حل-تعارض-طبق-source-of-truth)

## ۱. سلسله‌مراتب (بالاتر برنده است)

```
1. Project Laws  (docs/00-governance/project-laws.md)
2. تصمیمِ صریحِ مالک در گفتگوی جاری  ← باید بلافاصله در سندِ مالک ثبت شود
3. Requirementهای APPROVED  (docs/03-requirements/requirement-catalog.md)
4. معماریِ canonical  (docs/01-architecture/*, docs/07-subsystems/*, docs/06-platform/*)
5. کد/schema/config فعلی در working tree شاخه‌ی فعال
     - schema  = فایل‌های server/src/db/mysql/migrations/*.sql|.mjs به ترتیب
     - API     = server/src/features/*/*.routes.ts + server/src/obs/obs.routes.ts (قرارداد: scripts/route-snapshot.txt)
     - config  = process.env.* در server/src + ثابت‌های کد
     - UI      = public/index.html، public/feelia-{rt,upload,obs,analytics}.js
6. تست‌های فعلی  (scripts/*harness*، route-snapshot، check-backend-boundaries، check-docs)
7. Reference catalogs  (docs/02-reference/*، feature-index و frontend-map) و docs/analytics-clarity.md
8. کامنت‌های داخلِ کد
9. Evidence  (verification/*)
10. HISTORICAL / DEPRECATED  (docs/admin-panel.md, session_assistant_v11 (3).html, server-deploy/)
```

## ۲. قواعدِ ویژه‌ی همین پروژه

### 2.1 REQها هنوز DERIVED هستند
همه‌ی REQها در 2026-09-13 **از روی کد استخراج** شده‌اند و هیچ‌کدام APPROVED نیست. بنابراین تا زمانِ تأیید:
- **REQ ↔ کد:** کد تعیین می‌کند «چه چیزی الان وجود دارد». REQ باید اصلاح شود، نه کد — مگر مالک خلافش را بگوید.
- **Law ↔ کد:** قانون برنده است؛ کد «violation» است و باید **گزارش** شود (نه اینکه بی‌صدا در همان task عوض شود).
- وقتی مالک REQی را تأیید کرد، ستونِ Status آن `APPROVED` می‌شود و از آن به بعد در سطحِ ۳ قرار می‌گیرد.

### 2.2 working tree در برابرِ HEAD در برابرِ production
- وضعیتِ محصول = کد + schema در working treeِ شاخه‌ی فعال؛ HEAD/commit/push/merge و **وضعیتِ production فقط در `PROJECT_STATUS.md`** (LAW-027) نگه‌داری می‌شود — هرگز از اسنادِ محتوا نتیجه نگیرید که چیزی deploy شده است.
- `origin/main` و فاصله‌اش با `feat/clarity`، و اینکه production رویِ کدام commit است: `git branch -vv` و آخرین ورودیِ deploy در Event Log.

### 2.3 schema
حقیقتِ schema = اجرای ترتیبیِ migrationها. اگر DBِ واقعی با آن فرق دارد (مثلاً migration دستی)، این drift است و باید گزارش شود؛ migration جدید آن را رفع می‌کند، نه ویرایشِ migration قبلی.

### 2.4 کامنت‌های کد
کامنت‌ها (عمدتاً فارسی و مفصل) ارزشمندند ولی **بعضی قدیمی‌اند**. نمونه‌های تأییدشده:
- `public/feelia-rt.js` (سربرگ): «صوت durable فقط در failure به سرور می‌رود و بعد حذف می‌شود» — دیگر درست نیست (`archiveQueuedAudioOnly`).
- `server/src/features/legacy-ws/soniox.ts` (کامنتِ `enable_endpoint_detection`): می‌گوید این موتور برای batch/یادداشتِ صوتی استفاده می‌شود — batch اکنون از `asyncTranscribe.ts` استفاده می‌کند.
- `server/src/features/transcription/batch/` (سربرگ): «صوت فقط در مسیرِ شکست… بلافاصله بعد از موفقیت حذف می‌شود» — اکنون قبل از حذف آرشیو می‌شود.
در تعارض، کدِ اجرایی برنده است.

### 2.5 رفتارِ Soniox
رفتارِ API خارجی: مستنداتِ رسمیِ Soniox (آنلاین) > `soniox.html` (کپیِ محلی، untracked، تاریخ نامعلوم) > کامنت‌های کد.

### 2.6 Clarity
برای allowlistِ رویدادها و فهرستِ mask: `public/feelia-analytics.js` و `data-clarity-mask`های `index.html` حقیقت‌اند؛ `docs/analytics-clarity.md` سندِ مالکِ توضیح است و باید با آن‌ها هم‌گام بماند.

## ۳. مالکِ هر نوع fact (One fact → One owner)

| نوع fact | مالک |
|---|---|
| قانون/ممنوعیت | `docs/00-governance/project-laws.md` |
| نگاشتِ feature ↔ کد ↔ سند ↔ تست ↔ جدول | `docs/02-reference/feature-index.md` |
| «چرا»ی یک feature (تصمیم‌ها با تاریخ/مرجع) | بخشِ «چرا»ی سندِ مالکِ همان feature (قالب: `feature-doc-template.md`) |
| مالکِ جدولِ DB | `docs/02-reference/database-catalog.md` §۰ |
| نگاشتِ فرانت (صفحه/تابع/state) | `docs/02-reference/frontend-map.md` |
| قاعده‌ی کسب‌وکار / رفتارِ محصول | `docs/03-requirements/requirement-catalog.md` (+ PRD برای روایت) |
| تصمیمِ معماری / مرزها | `docs/01-architecture/*` |
| state machine و جزئیاتِ فنیِ پرریسک | `docs/07-subsystems/*` |
| endpoint و payload | `docs/02-reference/api-catalog.md` |
| جدول/ستون/enum | `docs/02-reference/database-catalog.md` |
| env/ثابت/کلیدِ storage | `docs/02-reference/configuration-catalog.md` |
| کدِ خطا | `docs/02-reference/error-code-catalog.md` |
| توالیِ اجرای تغییرات | `docs/04-modules/*/implementation-plan.md` و `docs/05-plans/master-implementation-plan.md` |
| نتیجه‌ی تست در یک تاریخ | `verification/*` |
| رویداد/mask ِ Clarity | `docs/analytics-clarity.md` |

## ۴. گزارشِ تعارض

هر تعارضِ پیداشده باید در پاسخ به کاربر ذکر شود و در سندِ مالک (بخشِ «Known contradictions» یا «Risks») ثبت شود، با: منبع A، منبع B، کدام برنده است، و اقدامِ پیشنهادی.
فهرستِ تعارض‌های فعلی: بخشِ ۵ [documentation-map](documentation-map.md).
