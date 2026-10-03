-- 044: «همه‌چیز قابلِ بازیابی باشد» (تصمیمِ مالک 2026-10-02) — تاریخچه‌یِ فقط‌افزودنیِ دو جایی که ویرایش متنِ قبلی را بازنویسی می‌کرد:
-- (۱) session_note_revisions: متنِ قبلیِ یادداشت (PATCH /api/notes/:id) پیش از جایگزینی.
-- (۲) client_case_file_versions: محتوایِ قبلیِ پرونده‌یِ درمان پیش از هر نوشتن (PATCH/regenerate/merge). UNIQUE(client_id, content_version) ⇒ تکرار ندارد.
-- additive (LAW-007). FK/CASCADE فقط برایِ سازگاری با schema؛ حذفِ سختِ والد در کد مسدود است (LAW-010).
CREATE TABLE IF NOT EXISTS session_note_revisions (
    id          BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    note_id     CHAR(36)     NOT NULL,
    session_id  CHAR(36)     NOT NULL,
    text        LONGTEXT     NULL,
    actor       CHAR(36)     NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_snr_note (note_id, id),
    CONSTRAINT fk_snr_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_case_file_versions (
    id               BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id        CHAR(36)     NOT NULL,
    content_version  INT          NOT NULL,
    content          LONGTEXT     NOT NULL,
    status           VARCHAR(16)  NULL,
    model            VARCHAR(100) NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ccfv (client_id, content_version),
    CONSTRAINT fk_ccfv_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
