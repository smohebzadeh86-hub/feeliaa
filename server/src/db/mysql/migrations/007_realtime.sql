-- معادلِ MySQLِ 007_realtime.sql. افزودنیِ خالص.
ALTER TABLE sessions ADD COLUMN transcript_version INT NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN realtime_reliable BOOLEAN NULL;
ALTER TABLE sessions ADD COLUMN stt_mode VARCHAR(32) NULL;
ALTER TABLE sessions ADD COLUMN batch_status VARCHAR(16) NULL;

-- MySQL ایندکسِ جزئی (`WHERE batch_status IS NOT NULL`) ندارد؛ ایندکسِ کامل معادلِ
-- عملکردی برایِ همان کوئری فراهم می‌کند.
CREATE INDEX idx_sessions_batch ON sessions(batch_status);
