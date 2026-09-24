-- فیچرِ «آپلودِ فایلِ صوتیِ جلسه» + رفعِ دو باگِ audit (2026-09-23، دستورِ صریحِ مالک).
-- هشدار: runner فایل را با کاراکترِ نقطه‌ویرگولِ ASCII می‌شکند — در کامنت‌ها از آن استفاده نکنید.
--
-- 1) audio_uploads: آپلودِ تکه‌تکه و قابلِ ادامه. تکه‌ها رویِ دیسک‌اند (data/uploads/<id>/)،
--    نه در DB. fingerprint برایِ تشخیصِ آپلودِ تکراری/ادامه‌ی همان فایل بعد از رفرش است.
-- 2) audio_jobs: یک job به ازایِ هر آپلودِ کامل‌شده. تمامِ وضعیت (مرحله، تعدادِ تلاش، شناسه‌هایِ
--    Soniox، lease) در DB است تا ری‌استارتِ سرور هیچ jobی را گم نکند.
-- 3) notifications: اعلان‌هایِ پایدارِ تراپیست. UNIQUE(job_id, kind) یعنی retry اعلانِ تکراری نمی‌سازد.
-- 4) session_audio.transcribed_at: رفعِ F1 — سگمنتی که متنش یک‌بار merge شده دوباره merge نمی‌شود.
-- 5) client_case_file.content_version: رفعِ F6 — CAS رویِ محتوایِ پرونده (lost update).

CREATE TABLE IF NOT EXISTS audio_uploads (
    id             CHAR(36)     NOT NULL PRIMARY KEY,
    therapist_id   CHAR(36)     NOT NULL,
    client_id      CHAR(36)     NOT NULL,
    session_id     CHAR(36)     NULL,
    fingerprint    VARCHAR(128) NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    mime           VARCHAR(100) NULL,
    size_bytes     BIGINT       NOT NULL,
    chunk_size     INT          NOT NULL,
    chunks_total   INT          NOT NULL,
    session_date   VARCHAR(10)  NULL,
    status         VARCHAR(16)  NOT NULL DEFAULT 'uploading',
    error_code     VARCHAR(40)  NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at   DATETIME     NULL,
    KEY idx_audio_uploads_therapist_fp (therapist_id, fingerprint),
    KEY idx_audio_uploads_status_updated (status, updated_at),
    CONSTRAINT fk_audio_uploads_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_uploads_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_uploads_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT audio_uploads_status_check CHECK (status IN ('uploading','complete','failed','canceled'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audio_jobs (
    id                      CHAR(36)     NOT NULL PRIMARY KEY,
    upload_id               CHAR(36)     NOT NULL,
    therapist_id            CHAR(36)     NOT NULL,
    client_id               CHAR(36)     NOT NULL,
    session_id              CHAR(36)     NOT NULL,
    stage                   VARCHAR(16)  NOT NULL DEFAULT 'queued',
    attempts                INT          NOT NULL DEFAULT 0,
    next_attempt_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until            DATETIME     NULL,
    source_path             TEXT         NULL,
    normalized_path         TEXT         NULL,
    duration_ms             INT          NULL,
    soniox_file_id          VARCHAR(64)  NULL,
    soniox_transcription_id VARCHAR(64)  NULL,
    transcription_started_at DATETIME    NULL,
    transcript_applied_at   DATETIME     NULL,
    transcript_chars        INT          NULL,
    case_file_status        VARCHAR(16)  NULL,
    error_code              VARCHAR(40)  NULL,
    created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    finished_at             DATETIME     NULL,
    UNIQUE KEY uq_audio_jobs_upload (upload_id),
    KEY idx_audio_jobs_due (stage, next_attempt_at),
    KEY idx_audio_jobs_therapist (therapist_id, updated_at),
    KEY idx_audio_jobs_session (session_id),
    CONSTRAINT fk_audio_jobs_upload FOREIGN KEY (upload_id) REFERENCES audio_uploads(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_jobs_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_jobs_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_audio_jobs_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT audio_jobs_stage_check CHECK (stage IN ('queued','normalizing','transcribing','case_file','done','failed'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    therapist_id  CHAR(36)     NOT NULL,
    kind          VARCHAR(32)  NOT NULL,
    client_id     CHAR(36)     NULL,
    session_id    CHAR(36)     NULL,
    job_id        CHAR(36)     NULL,
    error_code    VARCHAR(40)  NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at       DATETIME     NULL,
    UNIQUE KEY uq_notifications_job_kind (job_id, kind),
    KEY idx_notifications_therapist (therapist_id, created_at),
    CONSTRAINT fk_notifications_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE session_audio ADD COLUMN transcribed_at DATETIME NULL;

-- جلسه‌ای که از فایلِ آپلودی ساخته می‌شود source='upload' می‌گیرد (قبلاً فقط live/manual مجاز بود).
-- اجرایِ دوباره: DROPِ constraintِ ناموجود (errno 3821) در migrate.ts قابلِ چشم‌پوشی است.
ALTER TABLE sessions DROP CHECK sessions_source_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_source_check CHECK (source IN ('live','manual','upload'));

ALTER TABLE client_case_file ADD COLUMN content_version INT NOT NULL DEFAULT 0;
