# پاکسازیِ صدا و منابعِ Soniox هنگامِ حذف (session-media)

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../02-reference/feature-index.md) (`session-media`) · وضعیت: ACTIVE-CANONICAL

## ۱. چرا (Why)
- **مسئله (LAW-010):** حذفِ مراجع/جلسه/تراپیست ردیف‌هایِ `session_audio` را cascade می‌کند ولی پوشه‌هایِ `data/session-audio/<sessionId>` و فایل/transcriptionِ Soniox را نه ⇒ داده‌ی صوتیِ یتیم (ریسکِ R4).
- **تصمیم** (Event Log 2026-09-22 «رفعِ فایل‌هایِ یتیم»، 2026-09-28 «بازسازیِ ماژولار»): دُمِ مشترکِ دو-گامه برایِ هر سه مسیرِ حذف، تا کدِ تکراری در چهار route نماند؛ هر route چکِ مالکیت، پیامِ 404، `logEvent` و ممیزیِ خودش را نگه می‌دارد.

## ۲. چه می‌کند (What)
`prepareSessionMediaPurge(sessionIds)` **پیش از** `DELETE` شناسه‌ها و ارجاع‌هایِ Soniox را جمع می‌کند (بعد از حذف قابلِ خواندن نیستند)؛ `purgeSessionMedia(p)` **فقط بعد از** موفقیتِ `DELETE` پوشه‌هایِ صدا را پاک و منابعِ Soniox را آزاد می‌کند (fire-and-forget).

## ۳. مرزها (Boundaries)
`features/session-media/index.ts` (export دو تابع + نوع). وابستگی: `features/transcription` (`deleteSessionAudioDirs`)، `features/audio-upload` (`collectUploadSonioxRefs`، `releaseSonioxRefs`). مصرف: `sessions/sessions.routes.ts`، `clients/clients.routes.ts`، `admin/therapists.admin.ts`. جهتِ وابستگی برایِ جلوگیری از چرخه انتخاب شده ([application-architecture §1.3](../01-architecture/application-architecture.md)).

## ۴. کد (Code)
`server/src/features/session-media/purge.ts`.

## ۵. داده (Data)
جدولِ مالک ندارد. فایل‌ها: `data/session-audio/<sessionId>/`؛ `data/uploads/` را sweeperِ `audio-upload/orphanSweep.ts` (ردیفِ بی‌مالک) پاک می‌کند. `obs_*`/`audit_log` عمداً باقی می‌مانند.

## ۶. API و config
مسیرهایِ حذف: [api-catalog](../02-reference/api-catalog.md) (`DELETE /api/sessions/:id`، `/api/clients/:id`، `/api/admin/clients/:id`، `/api/admin/therapists/:id`). ثابت‌هایِ نگهداری: [configuration-catalog](../02-reference/configuration-catalog.md).

## ۷. تست (Tests)
`pnpm test:api` (fixtureهایِ ساختگی، فقط با مجوزِ مالک). harnessِ اختصاصی ندارد.

## ۸. ریسک و بدهی
purge پس از DELETE و غیرِ تراکنشی است؛ کرشِ بینِ دو گام فایلِ یتیم می‌سازد (sweeperِ orphan برایِ `uploads`؛ برایِ `session-audio` sweeperِ سنی). حذفِ IndexedDBِ مرورگر خارج از دامنه است.
