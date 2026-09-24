-- آپلودِ چندبخشی برایِ یک جلسه (دستورِ مالک، 2026-09-25): «بشه چند فایل هم اپلود کرد — مربوط به همون جلسه و به ترتیبِ اپلود ترنسکریپت بشه».
-- هر بخش یک ردیفِ عادیِ audio_uploads است (آپلودِ تکه‌تکه و قابلِ ادامه‌ی خودش را دارد) با group_id مشترک و part_index.
-- بخشی که complete شد و هنوز بخش‌هایِ دیگر نرسیده‌اند: status='complete' و session_id=NULL (منتظر).
-- وقتی همه‌ی بخش‌ها رسیدند: یک جلسه + یک job ساخته می‌شود. job در مرحله‌ی normalizing همه‌ی بخش‌ها را به ترتیبِ
-- part_index با ffmpeg به یک فایل وصل می‌کند ⇒ یک رونویسی و تفکیکِ گوینده‌ی یکدست برایِ کلِ جلسه.
-- audio_jobs.source_parts: JSON آرایه‌ی {uploadId, path} به ترتیب (NULL برایِ آپلودِ تک‌فایلیِ قبلی — رفتار بدونِ تغییر).
-- additive و بدونِ backfill.
ALTER TABLE audio_uploads ADD COLUMN group_id CHAR(36) NULL;
ALTER TABLE audio_uploads ADD COLUMN part_index INT NULL;
ALTER TABLE audio_uploads ADD COLUMN parts_total INT NULL;
ALTER TABLE audio_uploads ADD COLUMN duration_ms INT NULL;
CREATE INDEX idx_audio_uploads_group ON audio_uploads (therapist_id, group_id);
ALTER TABLE audio_jobs ADD COLUMN source_parts TEXT NULL;
