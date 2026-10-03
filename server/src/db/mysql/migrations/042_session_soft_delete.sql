-- 042: حذفِ نرمِ جلسه (تصمیمِ مالک 2026-10-02): «حذفِ جلسه» توسطِ تراپیست دیگر داده را نابود نمی‌کند — فقط از فهرست/APIِ تراپیست
-- پنهان می‌شود (deleted_at) و برایِ ادمین (و بازگردانیِ تراپیست/ادمین) می‌ماند. additive (LAW-007)؛ NULL = حذف‌نشده.
-- deleted_by = therapists.id حذف‌کننده (بدونِ FK: با حذفِ حسابِ تراپیست کلِ جلسه‌ها cascade می‌شود).
ALTER TABLE sessions ADD COLUMN deleted_at DATETIME NULL;
ALTER TABLE sessions ADD COLUMN deleted_by CHAR(36) NULL;
ALTER TABLE sessions ADD KEY idx_sessions_deleted (deleted_at);
