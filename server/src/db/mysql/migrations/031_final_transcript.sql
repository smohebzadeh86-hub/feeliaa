-- 031: «متنِ نهاییِ جلسه» — رونویسیِ دوباره‌ی کلِ صدا با stt-async + مرتب‌سازی با LLM (دستورِ مالک 2026-09-27).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- additive: sessions.transcript دست نمی‌خورد (LAW-008) و متنِ نهایی جدا نگه داشته می‌شود.
-- قابلیت برایِ هر درمانگر جدا روشن می‌شود و پیش‌فرض خاموش است.

ALTER TABLE therapists ADD COLUMN final_transcript_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS final_transcripts (
    session_id              CHAR(36)     NOT NULL PRIMARY KEY,
    therapist_id            CHAR(36)     NOT NULL,
    client_id               CHAR(36)     NOT NULL,
    stage                   VARCHAR(16)  NOT NULL DEFAULT 'waiting_audio',
    attempts                INT          NOT NULL DEFAULT 0,
    next_attempt_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until            DATETIME     NULL,
    source                  VARCHAR(16)  NULL,
    source_version          INT          NULL,
    soniox_file_id          VARCHAR(64)  NULL,
    soniox_transcription_id VARCHAR(64)  NULL,
    transcription_started_at DATETIME    NULL,
    async_text              LONGTEXT     NULL,
    clean_text              LONGTEXT     NULL,
    polish_report           JSON         NULL,
    error_code              VARCHAR(40)  NULL,
    queued_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    finished_at             DATETIME     NULL,
    KEY idx_final_transcripts_due (stage, next_attempt_at),
    CONSTRAINT fk_final_transcripts_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_final_transcripts_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE CASCADE,
    CONSTRAINT fk_final_transcripts_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT final_transcripts_stage_check CHECK (stage IN ('waiting_audio','transcribing','polishing','done','failed','skipped')),
    CONSTRAINT final_transcripts_source_check CHECK (source IS NULL OR source IN ('async','realtime'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
