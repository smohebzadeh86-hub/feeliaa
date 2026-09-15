-- 012: منبعِ جلسه — 'live' (جلسه‌ی زنده با رضایت و ضبط) یا 'manual' (ثبتِ دستیِ جلسه‌ی گذشته، بدونِ صدا)
-- افزودنیِ خالص؛ ردیف‌های موجود 'live' می‌شوند که با واقعیتشان یکی است.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'live';

DO $$ BEGIN
  ALTER TABLE sessions ADD CONSTRAINT sessions_source_check CHECK (source IN ('live','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
