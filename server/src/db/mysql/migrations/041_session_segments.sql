-- 041: رکوردِ canonicalِ جلسه (Session Data Engine، فاز ۳، 2026-10-01).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- هر «گذر» = یک ردیف در session_transcript_tokens (038) + ستون‌هایِ تازه: covers_full (آیا این گذر کلِ صدایِ جلسه را پوشش می‌دهد)
-- و source_version (sessions.transcript_version در لحظه‌ی ثبت، برایِ تشخیصِ کهنه‌شدن پس از ویرایشِ تراپیست).
-- session_segments: نوبت‌هایِ گوینده از توکن‌هایِ همان گذر (speaker_key، زمان، متن، اطمینان). فقط‌افزودنی (گذرِ تازه = ردیفِ تازه).
-- session_speaker_roles: نگاشتِ گوینده به نقش، تأییدِ تراپیست (یک ردیف به ازایِ هر گوینده‌ی جلسه، مستقل از گذر).
-- همه با جلسه حذف می‌شوند (FK CASCADE).

ALTER TABLE session_transcript_tokens ADD COLUMN covers_full TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE session_transcript_tokens ADD COLUMN source_version INT NULL;

CREATE TABLE IF NOT EXISTS session_segments (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    record_id       BIGINT       NOT NULL,
    session_id      CHAR(36)     NOT NULL,
    seq             INT          NOT NULL,
    speaker_key     VARCHAR(16)  NOT NULL,
    start_ms        INT          NULL,
    end_ms          INT          NULL,
    text            MEDIUMTEXT   NOT NULL,
    confidence_pct  TINYINT      NULL,
    UNIQUE KEY uq_seg_record_seq (record_id, seq),
    KEY idx_seg_session (session_id),
    CONSTRAINT fk_seg_record FOREIGN KEY (record_id) REFERENCES session_transcript_tokens(id) ON DELETE CASCADE,
    CONSTRAINT fk_seg_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_speaker_roles (
    session_id    CHAR(36)     NOT NULL,
    speaker_key   VARCHAR(16)  NOT NULL,
    role          VARCHAR(16)  NOT NULL,
    label         VARCHAR(40)  NULL,
    confirmed_by  CHAR(36)     NULL,
    confirmed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, speaker_key),
    CONSTRAINT fk_ssr_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT ssr_role_check CHECK (role IN ('therapist','client','member','other'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
