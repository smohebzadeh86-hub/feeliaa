-- 033: کیفیتِ فایلِ صوتیِ آپلودی (پلنِ B، پس از فاز ۰B — verification/2026-09-28-upload-audio-quality-phase0b.md).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- additive. هیچ داده‌ای حذف یا بازنویسی نمی‌شود.
--   audio_quality: سنجه‌هایِ سطحِ صدا (p10/p95/clip) و flagها — فقط «علتِ احتمالی»، بدونِ هیچ صدا یا متن.
--   quality_warning: 'low_confidence' وقتی سهمِ توکن‌هایِ کم‌اطمینانِ Soniox از آستانه بیشتر است.
--   low_conf_ratio: همان سهم (برایِ بازتنظیمِ آستانه با داده‌ی واقعی).

ALTER TABLE audio_jobs ADD COLUMN audio_quality JSON NULL;
ALTER TABLE audio_jobs ADD COLUMN quality_warning VARCHAR(32) NULL;
ALTER TABLE audio_jobs ADD COLUMN low_conf_ratio DECIMAL(6,4) NULL;
