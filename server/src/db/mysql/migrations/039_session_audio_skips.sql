-- 039: سگمنت‌هایِ صوتیِ «خالی» که کلاینت گزارش می‌کند (Session Data Engine، فاز ۱، 2026-10-01).
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- چرا: کلاینت برایِ هر سگمنتِ ۱۵ثانیه‌ای یک شماره (client_seq) مصرف می‌کند، حتی اگر سگمنت خالی باشد و هرگز آپلود نشود.
-- بدونِ این جدول، چکِ «سگمنتی گم نشده» نمی‌توانست فرقِ سگمنتِ خالی و سگمنتِ واقعاً گم‌شده را بفهمد.
-- فقط شماره (بدونِ صدا/متن). حذفِ جلسه ردیف را هم حذف می‌کند (FK CASCADE).

CREATE TABLE IF NOT EXISTS session_audio_skips (
    session_id   CHAR(36)    NOT NULL,
    run_id       VARCHAR(64) NOT NULL,
    client_seq   INT         NOT NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, run_id, client_seq),
    CONSTRAINT fk_sas_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
