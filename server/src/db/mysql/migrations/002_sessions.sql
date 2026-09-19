-- معادلِ MySQLِ 002_sessions.sql. client_id هنوز به clients اشاره می‌کند (001 قبلاً اجرا شده).
CREATE TABLE IF NOT EXISTS sessions (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    client_id   CHAR(36)    NOT NULL,
    session_num INT         NOT NULL,
    date        VARCHAR(10) NOT NULL,
    start_time  VARCHAR(5)  NOT NULL,
    consent     BOOLEAN     NOT NULL DEFAULT FALSE,
    duration_ms INT         NULL,
    status      VARCHAR(16) NOT NULL DEFAULT 'in_progress',
    transcript  LONGTEXT    NULL,
    anchors     JSON        NULL,
    txt_content TEXT        NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sessions_client_num (client_id, session_num),
    CONSTRAINT fk_sessions_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_sessions_client ON sessions(client_id, session_num DESC);
