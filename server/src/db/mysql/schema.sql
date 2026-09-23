-- =============================================================================
-- Feelia — schema.sql (MySQL 8.0+)
-- =============================================================================
-- این فایل تصویرِ کاملِ ساختارِ نهایی (بعد از اعمالِ همه‌ی migrationهای 001 تا 014ِ
-- اصلیِ Postgres، معادل‌سازی‌شده برای MySQL) است — برای ساختِ یک دیتابیسِ خالیِ تازه
-- در یک قدم. برای تاریخچه‌ی گام‌به‌گامِ تغییرات، پوشه‌ی migrations/ کنارِ همین فایل
-- را ببینید (هر فایل معادلِ همان‌شماره‌ی Postgres است).
--
-- منبع: server/src/db/migrations/001..014 (PostgreSQL) — ترجمه‌شده به MySQL 8.0.16+.
-- مالکِ ساختارِ Postgres: docs/02-reference/database-catalog.md (تغییر نکرده).
--
-- تصمیم‌های ترجمه (تفاوت با نسخه‌ی Postgres — دلیل هرکدام):
--   1) UUID  -> CHAR(36)      : MySQL نوعِ UUID ندارد؛ متنِ UUID (فرمتِ استاندارد) ذخیره می‌شود.
--   2) id ستون‌ها بدونِ DEFAULT: MySQL اجازه‌ی UUID()/gen_random_uuid() به‌عنوانِ DEFAULT
--      (تابعِ non-deterministic) در تعریفِ ستون را نمی‌دهد؛ UUID در برنامه (Node،
--      crypto.randomUUID()) قبل از INSERT ساخته و پاس داده می‌شود.
--   3) TIMESTAMPTZ -> DATETIME: MySQL TIMESTAMP بازه‌اش تا سالِ ۲۰۳۸ محدود است (مشکلِ
--      Y2038)؛ برای داده‌ی بالینیِ بدونِ محدودیتِ نگهداری از DATETIME استفاده شد. برنامه
--      باید همیشه UTC بنویسد/بخواند (معادلِ رفتارِ فعلیِ TIMESTAMPTZ).
--   4) JSONB -> JSON          : معادلِ بومیِ MySQL 8 (بدونِ فشرده‌سازیِ باینریِ Postgres،
--      ولی از نظرِ عملکردی یکسان برایِ نیازِ فعلی — anchors[]).
--   5) ایندکسِ یکتای جزئی (`WHERE phone IS NOT NULL`) حذف شد: در MySQL هر NULL در یک
--      UNIQUE INDEX جداگانه شمرده می‌شود (رفتارِ پیش‌فرض) — پس UNIQUE سادهٔ MySQL روی
--      phone دقیقاً همان اثرِ ایندکسِ جزئیِ Postgres را دارد، بدونِ نیاز به شرط.
--   6) ایندکسِ جزئیِ `WHERE batch_status IS NOT NULL` : معادلِ جزئی در MySQL وجود ندارد؛
--      ایندکسِ کامل (بدونِ فیلتر) ساخته شد — عملکردی معادل برایِ کوئریِ `WHERE batch_status
--      IS NOT NULL`، فقط کمی حجیم‌تر روی دیسک.
--   7) CHECK constraints: از MySQL 8.0.16 پشتیبانی می‌شود؛ رفتار یکسان با Postgres.
--   8) ON CONFLICT ... DO UPDATE (session_audio) -> در برنامه با
--      `INSERT ... ON DUPLICATE KEY UPDATE` بازنویسی می‌شود (نیازمندِ UNIQUE(session_id, seq)
--      که همین‌جا تعریف شده).
--   9) هیچ `RETURNING` در MySQL وجود ندارد؛ برنامه بعد از INSERT یا مقدارِ ارسالی را
--      برمی‌گرداند (چون UUID را خودش ساخته) یا با SELECTِ جداگانه می‌خواند.
--
-- کاراکترست: utf8mb4 برای پشتیبانیِ کاملِ فارسی/یونیکد (معادلِ client_encoding=UTF8 در
-- LAW-021)؛ اتصال باید با charset=utf8mb4 برقرار شود.

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- _migrations — جدولِ ردیابیِ migrationهای اعمال‌شده (ساخته‌شده در migrate runner)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _migrations (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_migrations_name (name)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- therapists  (004, 005, 006, 010)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapists (
    id             CHAR(36)     NOT NULL PRIMARY KEY,
    email          VARCHAR(255) NULL,
    password_hash  TEXT         NOT NULL,
    name           TEXT         NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    phone          VARCHAR(20)  NULL,
    is_admin       BOOLEAN      NOT NULL DEFAULT FALSE,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    specialty      TEXT         NULL,
    UNIQUE KEY uq_therapists_email (email),
    UNIQUE KEY uq_therapists_phone (phone)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- auth_sessions  (004)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash    CHAR(64)  NOT NULL PRIMARY KEY,  -- SHA-256 hex
    therapist_id  CHAR(36)  NOT NULL,
    created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    DATETIME  NOT NULL,
    CONSTRAINT fk_auth_sessions_therapist FOREIGN KEY (therapist_id)
        REFERENCES therapists(id) ON DELETE CASCADE,
    KEY idx_auth_sessions_therapist (therapist_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- clients  (001, 004, 008, 009)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id             CHAR(36)     NOT NULL PRIMARY KEY,
    code           VARCHAR(16)  NOT NULL,
    alias          TEXT         NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    therapist_id   CHAR(36)     NULL,
    status         VARCHAR(16)  NOT NULL DEFAULT 'active',
    status_reason  TEXT         NULL,
    category       VARCHAR(16)  NULL,
    gender         VARCHAR(4)   NULL,
    pinned_at      DATETIME     NULL,
    UNIQUE KEY uq_clients_code (code),
    CONSTRAINT fk_clients_therapist FOREIGN KEY (therapist_id)
        REFERENCES therapists(id) ON DELETE CASCADE,
    KEY idx_clients_therapist (therapist_id),
    KEY idx_clients_status (therapist_id, status),
    CONSTRAINT clients_status_check CHECK (status IN ('active','inactive')),
    CONSTRAINT clients_category_check CHECK (category IS NULL OR category IN ('child','teen','adult')),
    CONSTRAINT clients_gender_check CHECK (gender IS NULL OR gender IN ('f','m'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- sessions  (002, 007, 012, 013-data, 014)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id                  CHAR(36)     NOT NULL PRIMARY KEY,
    client_id           CHAR(36)     NOT NULL,
    session_num         INT          NOT NULL,
    date                VARCHAR(10)  NULL,        -- شمسیِ YYYY/MM/DD؛ NULL فقط برای source='manual' بدونِ تاریخ
    start_time          VARCHAR(5)   NOT NULL,     -- HH:MM
    consent             BOOLEAN      NOT NULL DEFAULT FALSE,
    duration_ms         INT          NULL,
    status              VARCHAR(16)  NOT NULL DEFAULT 'in_progress',
    transcript          LONGTEXT     NULL,
    anchors             JSON         NULL,
    txt_content         TEXT         NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    transcript_version  INT          NOT NULL DEFAULT 0,
    realtime_reliable   BOOLEAN      NULL,
    stt_mode            VARCHAR(32)  NULL,
    batch_status        VARCHAR(16)  NULL,
    source              VARCHAR(8)   NOT NULL DEFAULT 'live',
    UNIQUE KEY uq_sessions_client_num (client_id, session_num),
    CONSTRAINT fk_sessions_client FOREIGN KEY (client_id)
        REFERENCES clients(id) ON DELETE CASCADE,
    KEY idx_sessions_client (client_id, session_num DESC),
    KEY idx_sessions_batch (batch_status),
    CONSTRAINT sessions_source_check CHECK (source IN ('live','manual'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- session_notes  (003)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_notes (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    session_id  CHAR(36)     NOT NULL,
    type        VARCHAR(16)  NOT NULL,
    text        TEXT         NULL,
    sign_type   VARCHAR(64)  NULL,
    offset_ms   INT          NULL,
    wall_clock  VARCHAR(16)  NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notes_session FOREIGN KEY (session_id)
        REFERENCES sessions(id) ON DELETE CASCADE,
    KEY idx_notes_session (session_id, offset_ms)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- session_audio  (011 + 016 + 017)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_audio (
    id          CHAR(36)     NOT NULL PRIMARY KEY,
    session_id  CHAR(36)     NOT NULL,
    seq         INT          NOT NULL,
    path        TEXT         NOT NULL,
    bytes       INT          NOT NULL,
    mime        VARCHAR(64)  NULL,
    source      VARCHAR(16)  NOT NULL DEFAULT 'durable',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INT          NULL,                          -- (016) از ری‌ماکسِ ffmpeg؛ NULL اگر ffmpeg نبود
    run_id      VARCHAR(64)  NOT NULL DEFAULT 'legacy',      -- (017) هر RTSessionِ کلاینت یکی می‌گیرد
    kind        VARCHAR(8)   NOT NULL DEFAULT 'session',     -- (017)
    sha256      CHAR(64)     NULL,                           -- (017) idempotency روی retryِ همان بایت‌ها
    UNIQUE KEY uq_session_audio_run_seq (session_id, run_id, seq),  -- (017) جایگزینِ uq_session_audio_seq
    UNIQUE KEY uq_session_audio_sha (session_id, sha256),
    CONSTRAINT fk_session_audio_session FOREIGN KEY (session_id)
        REFERENCES sessions(id) ON DELETE CASCADE,
    KEY idx_session_audio_created (created_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- client_case_file  (018) — پرونده‌ی روندِ درمان (AI Case File)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_case_file (
    client_id                  CHAR(36)     NOT NULL PRIMARY KEY,
    content                    JSON         NOT NULL,
    status                     VARCHAR(16)  NOT NULL DEFAULT 'ready',
    generating_started_at      DATETIME     NULL,             -- (019) قفلِ نرم برایِ جلوگیری از race
    model                      VARCHAR(64)  NULL,
    prompt_version             INT          NOT NULL DEFAULT 1,
    generated_at                DATETIME    NULL,
    generated_from_session_id  CHAR(36)     NULL,             -- عمداً بدونِ FK سخت — snapshot مستقل
    corpus_signature           VARCHAR(255) NULL,             -- (019) برایِ رد کردنِ regenerate بدونِ داده‌ی جدید
    therapist_edited_at        DATETIME     NULL,
    force_regenerated_at       DATETIME     NULL,
    force_regenerated_by       CHAR(36)     NULL,
    error_message              TEXT         NULL,
    created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_case_file_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT client_case_file_status_check CHECK (status IN ('ready','generating','error','stale'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- obs_events / obs_ui_events  (021) — لایه‌ی رصد و حسابرسی، فاز ۱.
-- عمداً بدونِ FK و با PK از نوعِ BIGINT (نه UUID) — رجوع به کامنتِ سرِ
-- migrations/021_observability_events.sql و database-catalog.md برایِ دلیل.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obs_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    client_ts DATETIME(3) NULL,
    source ENUM('server','client','job') NOT NULL,
    severity ENUM('debug','info','warn','error') NOT NULL DEFAULT 'info',
    event VARCHAR(64) NOT NULL,
    code VARCHAR(64) NULL,
    therapist_id CHAR(36) NULL,
    client_id CHAR(36) NULL,
    session_id CHAR(36) NULL,
    run_id VARCHAR(64) NULL,
    request_id VARCHAR(64) NULL,
    nav_id CHAR(36) NULL,
    route VARCHAR(128) NULL,
    method VARCHAR(8) NULL,
    status_code SMALLINT NULL,
    duration_ms INT NULL,
    detail JSON NULL,
    KEY idx_obs_events_ts (ts),
    KEY idx_obs_events_therapist_ts (therapist_id, ts),
    KEY idx_obs_events_session_ts (session_id, ts),
    KEY idx_obs_events_event_ts (event, ts),
    KEY idx_obs_events_request (request_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS obs_ui_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    client_ts DATETIME(3) NULL,
    therapist_id CHAR(36) NULL,
    session_id CHAR(36) NULL,
    nav_id CHAR(36) NULL,
    seq INT NOT NULL,
    kind ENUM('click','nav','visibility','net','lifecycle','error') NOT NULL,
    screen VARCHAR(64) NULL,
    target_id VARCHAR(64) NULL,
    target_role VARCHAR(32) NULL,
    target_tag VARCHAR(16) NULL,
    value_num INT NULL,
    KEY idx_obs_ui_events_ts (ts),
    KEY idx_obs_ui_events_therapist_ts (therapist_id, ts),
    KEY idx_obs_ui_events_session_ts (session_id, ts),
    KEY idx_obs_ui_events_nav_seq (nav_id, seq)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
