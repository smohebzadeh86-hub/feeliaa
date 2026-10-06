# اعلان‌هایِ درون‌اپ (notifications)

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../02-reference/feature-index.md) (`notifications`) · وضعیت: ACTIVE-CANONICAL

## ۱. چرا (Why)
- **مسئله:** پردازشِ پس‌زمینه (آپلودِ صدا، «متنِ نهایی»، پرونده) دقایق طول می‌کشد و کاربر ممکن است صفحه را ببندد؛ باید نتیجه/شکست را بعداً ببیند. SMS/Web Push در پروژه وجود ندارد ([subsystems README](../07-subsystems/README.md)).
- **تصمیم‌ها** (Event Log 2026-09-23 «آپلودِ فایلِ صوتی»، 2026-09-28): اعلانِ درون‌اپِ پایدار در DB؛ `UNIQUE(job_id, kind)` تا retry اعلانِ تکراری نسازد؛ **بدونِ متنِ بالینی** (فقط kind + شناسه)؛ `llm_unavailable` فقط برایِ ادمین‌ها (2026-09-28).

## ۲. چه می‌کند (What)
`notify.ts` اعلان می‌سازد (`transcript_ready`، `transcript_low_quality`، `transcript_empty`، `processing_failed`، `case_file_updated`، `case_file_failed`، `final_transcript_ready`، `llm_unavailable`). `GET /api/notifications` ۳۰ اعلانِ اخیر + شمارنده‌ی خوانده‌نشده؛ `POST /api/notifications/read` علامتِ خوانده (با کلیک رویِ اعلان، «خواندن همه»، یا — از 2026-10-05 — بازکردنِ خودِ جلسه: `{session_id}` از `doViewTranscript` و وقتی اعلانِ تازه برایِ جلسه‌یِ بازِ قابلِ‌دیدن می‌رسد). `sweepOldNotifications` روزانه (نگهداری: [configuration-catalog](../02-reference/configuration-catalog.md)).

## ۳. مرزها (Boundaries)
`features/notifications/index.ts` (export `createNotification`، `notifyAdmins`، `sweepOldNotifications`)؛ routeها در `notifications.routes.ts` (طبقِ R3 مستقیم از `app.ts` import می‌شود). مصرف: `audio-upload`، `final-transcript`، `case-file`، `jobs/backgroundJobs.ts` (هشدارِ LLM). route در scopeِ آپلود ثبت می‌شود (parserِ `application/octet-stream`؛ قراردادِ عمدی — [route-map §۲](../02-reference/route-map.md)).

## ۴. کد (Code)
`server/src/features/notifications/{notify,notifications.routes,index}.ts`؛ فرانت: زنگِ اعلان و poll در `index.html` ([frontend-map](../02-reference/frontend-map.md)).

## ۵. داده (Data)
مالک: `notifications` (FK CASCADE به therapist/client/session؛ `read_at`) — [database-catalog](../02-reference/database-catalog.md).

## ۶. API و config
[api-catalog §8.1](../02-reference/api-catalog.md) (`/api/notifications`، `/api/notifications/read`).

## ۷. تست (Tests)
`pnpm test:up` (ساختِ اعلان از ماشینِ حالتِ job). مسیرِ HTTP با `test:api`.

## ۸. ریسک و بدهی
`POST /api/notifications/read` با `application/octet-stream` ⇒ 200ِ بی‌اثر (FINDING، عمداً حفظ شد). `kind` بدونِ CHECK در DB.
