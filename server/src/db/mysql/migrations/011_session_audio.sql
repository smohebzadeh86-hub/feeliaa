-- معادلِ MySQLِ 011_session_audio.sql.
CREATE TABLE IF NOT EXISTS session_audio (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    session_id  CHAR(36)    NOT NULL,
    seq         INT         NOT NULL,
    path        TEXT        NOT NULL,
    bytes       INT         NOT NULL,
    mime        VARCHAR(64) NULL,
    source      VARCHAR(16) NOT NULL DEFAULT 'durable',
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_session_audio_seq (session_id, seq),
    CONSTRAINT fk_session_audio_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_session_audio_session ON session_audio(session_id, seq);
CREATE INDEX idx_session_audio_created ON session_audio(created_at);
