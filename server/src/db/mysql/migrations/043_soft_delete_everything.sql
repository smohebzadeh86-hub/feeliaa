-- 043: «هیچ چیزی هارد دیلیت نشود» (تصمیمِ مالک 2026-10-02) — ادامه‌یِ 042: حذفِ نرمِ مراجع، یادداشت و عضوِ واحدِ درمان.
-- additive (LAW-007)؛ NULL = حذف‌نشده. deleted_by = therapists.id حذف‌کننده (بدونِ FK).
ALTER TABLE clients ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE clients ADD COLUMN deleted_by CHAR(36) NULL;
ALTER TABLE clients ADD KEY idx_clients_deleted (deleted_at);
ALTER TABLE session_notes ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE session_notes ADD COLUMN deleted_by CHAR(36) NULL;
ALTER TABLE client_members ADD COLUMN deleted_at DATETIME NULL;
