-- بستنِ خودکارِ جلسه‌ی زنده‌ی رهاشده (پلنِ رفعِ ذخیره‌سازی، A3، تصمیمِ مالک 2026-09-26: «خودکار بسته شود»).
-- NULL = جلسه به‌صورتِ عادی بسته شده یا هنوز باز است. مقدار = زمانی که worker (server/src/http/sessionAutoClose.ts)
-- جلسه‌ی in_progress/recovered بی‌فعالیت را completed کرد. جلسه‌ی خودکاربسته قابلِ ادامه است (PUT status=in_progress
-- یا mintِ realtime آن را باز و این ستون را NULL می‌کند). additive، بدونِ backfill.
ALTER TABLE sessions ADD COLUMN auto_closed_at DATETIME NULL;
