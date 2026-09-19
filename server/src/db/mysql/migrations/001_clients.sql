-- معادلِ MySQLِ 001_clients.sql (Postgres). id بدونِ DEFAULT: UUID در برنامه ساخته می‌شود.
CREATE TABLE IF NOT EXISTS clients (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    code        VARCHAR(16) NOT NULL,
    alias       TEXT        NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_clients_code (code)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
