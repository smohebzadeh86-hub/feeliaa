-- معادلِ MySQLِ 012_session_source.sql. افزودنیِ خالص؛ ردیف‌های موجود 'live' می‌شوند.
ALTER TABLE sessions ADD COLUMN source VARCHAR(8) NOT NULL DEFAULT 'live';
ALTER TABLE sessions ADD CONSTRAINT sessions_source_check CHECK (source IN ('live','manual'));
