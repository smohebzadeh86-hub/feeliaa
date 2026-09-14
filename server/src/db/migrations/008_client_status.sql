ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS category TEXT;

DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN ('active','inactive'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT clients_category_check
    CHECK (category IS NULL OR category IN ('child','teen','adult-f','adult-m'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(therapist_id, status);
