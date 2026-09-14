-- آرشیوِ صدایِ جلسات — فقط برایِ بازبینیِ ادمین (دیباگِ باگ‌ها)، نه برایِ تراپیست/کاربرِ عادی.
-- فرق با data/batch-queue: اون یه صفِ گذرا برایِ رونویسی‌ست (بعدِ موفقیت پاک می‌شه)؛
-- این یه آرشیوِ عمدیه که مدتی (پیش‌فرض ۱۴ روز) نگه داشته می‌شه تا ادمین بتونه گوش بده.
CREATE TABLE IF NOT EXISTS session_audio (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq          INTEGER NOT NULL,
    path         TEXT NOT NULL,
    bytes        INTEGER NOT NULL,
    mime         TEXT,
    source       TEXT NOT NULL DEFAULT 'durable', -- 'durable' (fallback ضبط‌شده) | در آینده 'offline'
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_session_audio_session ON session_audio(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_session_audio_created ON session_audio(created_at);
