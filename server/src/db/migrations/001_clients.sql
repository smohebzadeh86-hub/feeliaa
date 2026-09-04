CREATE TABLE IF NOT EXISTS clients (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    alias       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);