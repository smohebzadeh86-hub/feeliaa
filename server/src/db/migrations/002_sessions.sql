CREATE TABLE IF NOT EXISTS sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_num INTEGER NOT NULL,
    date        TEXT NOT NULL,
    start_time  TEXT NOT NULL,
    consent     BOOLEAN NOT NULL DEFAULT false,
    duration_ms INTEGER,
    status      TEXT NOT NULL DEFAULT 'in_progress',
    transcript  TEXT,
    anchors     JSONB,
    txt_content TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(client_id, session_num)
);

CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id, session_num DESC);