-- معادلِ MySQLِ 004_therapists.sql.
CREATE TABLE IF NOT EXISTS therapists (
    id             CHAR(36)     NOT NULL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,
    password_hash  TEXT         NOT NULL,
    name           TEXT         NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_therapists_email (email)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash    CHAR(64)  NOT NULL PRIMARY KEY,
    therapist_id  CHAR(36)  NOT NULL,
    created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    DATETIME  NOT NULL,
    CONSTRAINT fk_auth_sessions_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_auth_sessions_therapist ON auth_sessions(therapist_id);

-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS در MySQL وجود ندارد؛ runner باید خطای
-- "Duplicate column name" (کدِ 1060) را برای idempotency بگیرد (نگاه کنید به README.md).
ALTER TABLE clients ADD COLUMN therapist_id CHAR(36) NULL;
ALTER TABLE clients ADD CONSTRAINT fk_clients_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE;
CREATE INDEX idx_clients_therapist ON clients(therapist_id);
