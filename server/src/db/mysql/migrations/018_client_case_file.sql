-- پرونده‌ی روندِ درمان (AI Case File) — یک ردیفِ سنتزشده به‌ازایِ هر مراجع.
-- محتوا (content) یک snapshotِ مستقل از داده‌ی خام است (sessions.transcript/session_notes)؛
-- طبقِ تصمیمِ مالک، generated_from_session_id عمداً بدونِ FK سخت است — حذفِ آن session
-- نباید پرونده‌ی سنتزشده را نامعتبر یا CASCADE-حذف کند (فقط snapshotِ آخرین regeneration است).
CREATE TABLE IF NOT EXISTS client_case_file (
    client_id                  CHAR(36)     NOT NULL PRIMARY KEY,
    content                    JSON         NOT NULL,
    status                     VARCHAR(16)  NOT NULL DEFAULT 'ready',
    model                      VARCHAR(64)  NULL,
    prompt_version             INT          NOT NULL DEFAULT 1,
    generated_at                DATETIME    NULL,
    generated_from_session_id  CHAR(36)     NULL,
    therapist_edited_at        DATETIME     NULL,
    force_regenerated_at       DATETIME     NULL,
    force_regenerated_by       CHAR(36)     NULL,
    error_message              TEXT         NULL,
    created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_case_file_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT client_case_file_status_check CHECK (status IN ('ready','generating','error','stale'))
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
