CREATE TABLE IF NOT EXISTS therapists (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    name           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash    TEXT PRIMARY KEY,
    therapist_id  UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_therapist ON auth_sessions(therapist_id);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_clients_therapist ON clients(therapist_id);
