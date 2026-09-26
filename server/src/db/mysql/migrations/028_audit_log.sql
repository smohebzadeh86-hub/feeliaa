-- ممیزی: «چه کسی، چه کاری، رویِ کدام داده، کِی» (پلنِ رفعِ ذخیره‌سازی، A6، 2026-09-26).
-- جدا از obs_events (که رصدِ فنی است و ۱۸۰ روز نگه داشته می‌شود): فقط کنش‌هایِ حساس (export، حذف، تغییرِ نقش/فعال‌بودن،
-- مشاهده‌ی متن و پخش/دانلودِ صدا توسطِ ادمین، ثبت/لغوِ رضایت، بستنِ خودکار). عمداً بدونِ FK — ردِ حسابرسی باید بعد از
-- حذفِ خودِ رکورد هم بماند (همان منطقِ D-E در LAW-010). detail فقط از sanitizeDetail عبور می‌کند (LAW-001).
-- نگهداری: فعلاً بدونِ انقضا — مدتِ نگهداری تصمیمِ مالک است (PROJECT_STATUS).
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ts              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    actor_id        CHAR(36)     NULL,
    actor_is_admin  BOOLEAN      NOT NULL DEFAULT FALSE,
    action          VARCHAR(48)  NOT NULL,
    target_type     VARCHAR(24)  NULL,
    target_id       CHAR(36)     NULL,
    detail          JSON         NULL,
    KEY idx_audit_log_ts (ts),
    KEY idx_audit_log_target (target_type, target_id, ts),
    KEY idx_audit_log_actor (actor_id, ts),
    KEY idx_audit_log_action (action, ts)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
