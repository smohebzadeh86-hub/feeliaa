-- 037: تاریخچه‌ی «متنِ نهایی» (Session Data Engine، 2026-10-01) — هیچ نسخه‌ای بازنویسی/گم نمی‌شود.
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- additive و فقط‌افزودنی: final_transcripts همچنان «نسخه‌ی جاری» است. هر ساخت (generated) و هر اصلاحِ نقش (role_edit)
-- یک ردیفِ کامل اینجا می‌گذارد. baseline = متنِ ساخته‌شده پیش از این migration که فقط پیش از اولین بازنویسی‌اش کپی می‌شود (بدونِ backfill).
-- حذفِ جلسه تاریخچه را هم حذف می‌کند (FK CASCADE) — همان نگهداریِ متنِ جلسه.

CREATE TABLE IF NOT EXISTS final_transcript_versions (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id      CHAR(36)     NOT NULL,
    version         INT          NOT NULL,
    kind            VARCHAR(16)  NOT NULL,
    source          VARCHAR(16)  NULL,
    source_version  INT          NULL,
    clean_text      LONGTEXT     NOT NULL,
    clean_turns     JSON         NULL,
    polish_report   JSON         NULL,
    created_by      CHAR(36)     NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ftv_session_version (session_id, version),
    CONSTRAINT fk_ftv_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    CONSTRAINT ftv_kind_check CHECK (kind IN ('baseline','generated','role_edit'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
