# 2026-10-01 — Core: دو باگِ گم‌شدنِ صدا، نمایِ کلیِ کیفیت، تاریخچه‌ی «متنِ نهایی»

> Evidence (مشاهده در یک زمان). ماشینِ dev. دستورِ مالک: «فعلا انجام بده همینارو 132» (موارد ۱، ۳، ۲ از پیشنهادِ همان گفتگو).

## چه ساخته شد
1. **باگ‌هایِ گم‌شدنِ صدا**
   - مرورگرِ مشترک: رکوردِ صفِ IndexedDB مالک (`owner`) دارد؛ 404 فقط رکوردِ تراپیستِ واردشده را حذف می‌کند؛ جاروب رکوردِ مالکِ دیگر را نمی‌فرستد (`public/feelia-rt.js`، `public/index.html`).
   - جاروبِ ۲۴ساعته‌ی صفِ batch: `.prenote.` ⇒ `kind='prenote'` (قبلاً `session`) — `archiveKindForFile` در `server/src/features/transcription/batch/queueFiles.ts`.
2. **نمایِ کلیِ کیفیت:** صفحه‌ی «کیفیتِ رونویسی» در پنلِ ادمین (`public/feelia-admin-quality.js`)، `GET /api/admin/upload-quality` (`audio-upload/adminQuality.ts`).
3. **تاریخچه‌ی «متنِ نهایی»:** migration 037 (`final_transcript_versions`)، `final-transcript/adapters/versionStore.ts`؛ نوشتن در `runner.finish` و اصلاحِ نقش؛ دو endpointِ ادمین + کارتِ تاریخچه در جزئیاتِ جلسه.

## تست‌ها (اجرا‌شده)
| دستور | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | تمیز |
| `pnpm test:rt` | 103 PASS / 0 FAIL (T57 جدید: مرورگرِ مشترک — 404 رکوردِ مالکِ دیگر/بی‌مالک را نگه می‌دارد، رکوردِ خود را حذف می‌کند، بدونِ مالکِ معلوم رفتارِ قبلی) |
| `pnpm test:up` | 64 PASS / 0 FAIL (H52 + `archiveKindForFile`؛ H63 جدید: مرتب‌سازیِ «بدترین اول» و جمع‌بندی) |
| `pnpm test:ft` / `test:tu` / `test:cf` | 61/61، 19/19، 111/111 |
| `pnpm test:arch` | OK (151 فایل، بدونِ چرخه) |
| `pnpm test:routes` | OK (141 route؛ snapshot عمداً به‌روز شد: ۳ routeِ جدیدِ ادمین، همه پشتِ `requireAdmin`) |
| parseِ اسکریپتِ inlineِ `index.html` و دو فایلِ JS | OK |

### مرورگرِ واقعی (Browser pane + mock backendِ scratchpad، دادهٔ ساختگی، بدونِ حساب)
- «کیفیتِ رونویسی»: کاشی‌ها (۳ جلسه، میانه ۹۵٪، کمینه ۷۱٪، ۲ هشدار)، پرتکرارترین مشکل‌ها، ردیف‌ها بدترین اول با برچسبِ پرچم؛ فیلترِ تراپیست (۱ ردیف)؛ «مشاهده» ⇒ جزئیاتِ جلسه با تبِ فعالِ «کیفیت» و برگشت به همان صفحه؛ حالتِ خالی؛ موبایل ۳۷۵px بدونِ اسکرولِ افقی؛ کنسول بدونِ خطا.
- کارتِ «تاریخچه‌ی متنِ نهایی»: ۳ نسخه (جاری/ساختِ خودکار/پیش از تاریخچه)، «نمایش» متنِ نسخه را می‌گیرد، جلسه‌ی بدونِ تاریخچه ⇒ کارت پنهان.

### MySQLِ dev (با مجوزِ مالک در همین گفتگو؛ fixtureِ ساختگی، حذف در پایان)
- `runMigrations`: `036_upload_transcript_metrics.sql` و `037_final_transcript_versions.sql` **applied** رویِ DBِ dev.
- ردیفِ `final_transcripts` ِ «پیش از 037» (v0) ⇒ `sqlFtStore.finish` ⇒ نسخه‌ی ۱ `baseline` (متنِ v0 حفظ شد) + نسخه‌ی ۲ `generated`؛ اصلاحِ نقش با همان تراکنشِ route ⇒ نسخه‌ی ۳ `role_edit` (`by_user`)، baseline تکرار نشد؛ `polish_report` فقط رویِ baseline/generated؛ نسخه‌ی ناموجود ⇒ null؛ پرس‌وجویِ `listAdminUploadQuality` بی‌خطا.
- پاکسازی: `DELETE therapists` ⇒ `versions=0 sessions=0` (CASCADE). اسکریپت حذف شد. یک رویدادِ `final_transcript.done` (فقط شناسه/عدد) در `obs_events` می‌ماند — طبقِ طراحیِ بدونِ FK (LAW-010).

## چه چیزی تست **نشده**
- route‌هایِ HTTPِ جدید با سرورِ واقعی و کوکیِ ادمین (منطقِ SQL مستقیم تست شد، route فقط سیم‌کشی است).
- هم‌زمانیِ واقعیِ دو نویسنده رویِ تاریخچه (قفلِ `FOR UPDATE` + UNIQUE فقط با خواندنِ کد).
- مرورگرِ مشترکِ واقعی با دو حساب.
- deploy نشده.
