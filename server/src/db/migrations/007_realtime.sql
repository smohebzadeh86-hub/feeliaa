-- 007: realtime production — مالکیت امن transcript + حالت batch
-- افزودنیِ خالص؛ هیچ دیتای موجودی دست نمی‌خورد.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS transcript_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS realtime_reliable BOOLEAN,
  ADD COLUMN IF NOT EXISTS stt_mode TEXT,
  ADD COLUMN IF NOT EXISTS batch_status TEXT;

-- وضعیت‌های batch: queued | processing | done | failed | null
CREATE INDEX IF NOT EXISTS idx_sessions_batch ON sessions(batch_status) WHERE batch_status IS NOT NULL;
