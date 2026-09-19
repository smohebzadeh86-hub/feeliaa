-- مدت‌زمانِ واقعیِ هر سگمنتِ صوتیِ آرشیوشده (میلی‌ثانیه) — از ری‌ماکسِ ffmpeg هنگامِ
-- آرشیو استخراج می‌شود؛ اگر ffmpeg در دسترس نباشد NULL می‌ماند (fail-open).
ALTER TABLE session_audio ADD COLUMN duration_ms INT NULL;
