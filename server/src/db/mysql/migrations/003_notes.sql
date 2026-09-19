-- معادلِ MySQLِ 003_notes.sql.
CREATE TABLE IF NOT EXISTS session_notes (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    session_id  CHAR(36)    NOT NULL,
    type        VARCHAR(16) NOT NULL,
    text        TEXT        NULL,
    sign_type   VARCHAR(64) NULL,
    offset_ms   INT         NULL,
    wall_clock  VARCHAR(16) NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notes_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_notes_session ON session_notes(session_id, offset_ms);
