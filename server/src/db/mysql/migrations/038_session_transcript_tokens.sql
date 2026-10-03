-- 038: توکن‌هایِ زمان‌دارِ رونویسیِ async (Session Data Engine، فاز ۲، 2026-10-01، تصمیمِ مالک: بعد از پاکسازیِ ۳۰روزهِ صدا بمانند).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- additive و فقط‌افزودنی. هر ردیف = خروجیِ توکنیِ یک رونویسی (متن، زمان، گوینده، اطمینان) به‌صورتِ JSONِ gzip.
-- فعلاً فقط مسیرِ آپلود (source = upload). حذفِ جلسه ردیف را هم حذف می‌کند (FK CASCADE) مثلِ متنِ جلسه.
-- جزئیاتِ قالب: server/src/features/audio-upload/tokenStore.ts

CREATE TABLE IF NOT EXISTS session_transcript_tokens (
    id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id   CHAR(36)     NOT NULL,
    job_id       CHAR(36)     NOT NULL,
    source       VARCHAR(16)  NOT NULL,
    engine       VARCHAR(32)  NOT NULL,
    model        VARCHAR(48)  NULL,
    token_count  INT          NOT NULL,
    tokens_gz    LONGBLOB     NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_stt_job (job_id),
    KEY idx_stt_session (session_id),
    CONSTRAINT fk_stt_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
