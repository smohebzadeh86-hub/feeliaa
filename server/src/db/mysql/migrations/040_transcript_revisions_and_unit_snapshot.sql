-- 040: تاریخچه‌ی متنِ خامِ جلسه + snapshotِ نوعِ واحدِ درمان روی خودِ جلسه (Session Data Engine، فاز ۲، 2026-10-01).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- (۱) session_transcript_revisions: هر جایگزینیِ *غیر-الحاقی* (PUT) متنِ قبلی را اینجا نگه می‌دارد. قبلاً resolve-speakers
--     و حذفِ مارکر کلِ sessions.transcript را بی‌سابقه جایگزین می‌کردند. فقط‌افزودنی، با جلسه حذف می‌شود (FK CASCADE).
--     cause: put یا resolve-speakers یا marker-remove یا edit (از change_reason کلاینت). version = transcript_versionِ متنِ جایگزین‌شده.
-- (۲) sessions.unit_type / sessions.modalities: snapshotِ لحظه‌ی ساختِ جلسه (قبلاً فقط روی مراجع/تراپیست بود و با تغییرِ آن‌ها
--     معنیِ جلساتِ قدیمی عوض می‌شد). NULL = جلسه‌ی پیش از 040 (نامعلوم، backfill نشده).

CREATE TABLE IF NOT EXISTS session_transcript_revisions (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id  CHAR(36)     NOT NULL,
    version     INT          NOT NULL,
    cause       VARCHAR(24)  NOT NULL,
    actor       CHAR(36)     NULL,
    chars       INT          NOT NULL,
    text        LONGTEXT     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_str_session (session_id, id),
    CONSTRAINT fk_str_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE sessions ADD COLUMN unit_type VARCHAR(24) NULL;
ALTER TABLE sessions ADD COLUMN modalities JSON NULL;
