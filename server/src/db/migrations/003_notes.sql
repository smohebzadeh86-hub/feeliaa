CREATE TABLE IF NOT EXISTS session_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    text        TEXT,
    sign_type   TEXT,
    offset_ms   INTEGER,
    wall_clock  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_session ON session_notes(session_id, offset_ms);