-- 045: رکوردِ realtimeِ جلسه‌ی زنده (core-data-plan-2026-10-03، قدمِ ۲).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- چرا: توکن‌هایِ finalِ Soniox که مرورگر حینِ جلسه می‌گیرد (متن، زمان، گوینده، اطمینان) قبلاً فقط به متن تبدیل و دور ریخته می‌شدند.
-- حالا مرورگر آن‌ها را تکه‌تکه می‌فرستد (staging) و در پایانِ جلسه یک گذرِ source = realtime در session_transcript_tokens ساخته می‌شود.
-- همان کلماتِ متنِ جلسه به‌علاوه‌ی زمان و گوینده — صدا یا متنِ جدیدی نیست. additive. حذفِ جلسه ردیف‌ها را هم حذف می‌کند (FK CASCADE).
-- meta: اطلاعاتِ سطحِ گذر (تعدادِ run/تکه، پایانِ صریح، قابل‌اعتماد بودن، توکنِ دورریخته) — فقط عدد/پرچم.

CREATE TABLE IF NOT EXISTS session_rt_token_chunks (
    id           BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    session_id   CHAR(36)     NOT NULL,
    run_id       VARCHAR(64)  NOT NULL,
    chunk_seq    INT          NOT NULL,
    token_count  INT          NOT NULL,
    tokens_gz    MEDIUMBLOB   NOT NULL,
    is_final     TINYINT(1)   NOT NULL DEFAULT 0,
    reliable     TINYINT(1)   NULL,
    dropped      INT          NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rtc_run_seq (session_id, run_id, chunk_seq),
    CONSTRAINT fk_rtc_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE session_transcript_tokens ADD COLUMN meta JSON NULL;
