-- 046: سنجه‌هایِ کیفیتِ هر گذرِ رکوردِ جلسه (core-data-plan-2026-10-03، قدمِ ۴).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- چرا: سنجه‌هایِ «کیفیت به عدد» (پوششِ متن، حفره‌ها، اطمینان، گوینده‌ها) فقط برایِ جلسه‌ی آپلودی در audio_jobs.transcript_metrics
-- حساب می‌شدند. حالا برایِ هر گذر (realtime، async، upload) رویِ همان ردیفِ session_transcript_tokens. فقط عدد و نامِ پرچم (LAW-001). additive.

ALTER TABLE session_transcript_tokens ADD COLUMN metrics JSON NULL;
ALTER TABLE session_transcript_tokens ADD COLUMN metrics_at DATETIME NULL;
