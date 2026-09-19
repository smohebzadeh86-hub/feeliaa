-- رفعِ باگِ بحرانی: قبلاً INSERT با ON DUPLICATE KEY UPDATE روی (session_id, seq) بود —
-- یادداشتِ صوتی یا ادامه‌ی جلسه بعدِ رفرش، هر دو seq را از ۰ شروع می‌کردند و صدای
-- سگمنتِ قبلی (مثلاً دقیقه‌ی اولِ جلسه) را بی‌صدا بازنویسی می‌کردند.
-- run_id (از کلاینت، هر RTSession یکی) باعث می‌شود seqهای هم‌نام از runهای مختلف
-- تصادم نکنند؛ sha256 امکانِ idempotent-بودنِ retry (آپلودِ دوبارهٔ همان بایت‌ها) را
-- بدون ردیفِ تکراری می‌دهد.
ALTER TABLE session_audio ADD COLUMN run_id VARCHAR(64) NOT NULL DEFAULT 'legacy';
ALTER TABLE session_audio ADD COLUMN kind VARCHAR(8) NOT NULL DEFAULT 'session';
ALTER TABLE session_audio ADD COLUMN sha256 CHAR(64) NULL;

ALTER TABLE session_audio DROP INDEX uq_session_audio_seq;
ALTER TABLE session_audio ADD UNIQUE KEY uq_session_audio_run_seq (session_id, run_id, seq);
-- NULL در MySQL برای UNIQUE چندبار مجاز است (ردیف‌های legacy بدونِ sha256 مشکلی ندارند)
ALTER TABLE session_audio ADD UNIQUE KEY uq_session_audio_sha (session_id, sha256);
