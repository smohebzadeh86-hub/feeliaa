-- (اختیاری — نیازمندِ DBA) لایه‌یِ دفاعِ پایگاه‌داده برایِ سیاستِ «هیچ چیزی هارد دیلیت نشود» (LAW-010، 2026-10-02).
-- کاربرِ اپ SUPER ندارد و binlog روشن است، پس این triggerها از خودِ اپ ساخته نمی‌شوند (ER_BINLOG_CREATE_ROUTINE_NEED_SUPER).
-- اجرا: یک بار توسطِ DBA با `SET GLOBAL log_bin_trust_function_creators = 1` (یا کاربرِ SUPER). بعد از آن هر DELETE روی این جدول‌ها
-- خطا می‌دهد مگر همان اتصال `SET @feelia_allow_hard_delete = 1` زده باشد (فقط برایِ عملیاتِ دستیِ آگاهانه).
-- ⚠️ DELIMITER فقط برایِ کلاینتِ mysql؛ اپ این فایل را اجرا نمی‌کند.
DELIMITER $$
CREATE TRIGGER trg_nohard_therapists BEFORE DELETE ON therapists FOR EACH ROW
BEGIN IF COALESCE(@feelia_allow_hard_delete, 0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'hard delete disabled (feelia LAW-010)'; END IF; END$$
CREATE TRIGGER trg_nohard_clients BEFORE DELETE ON clients FOR EACH ROW
BEGIN IF COALESCE(@feelia_allow_hard_delete, 0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'hard delete disabled (feelia LAW-010)'; END IF; END$$
CREATE TRIGGER trg_nohard_sessions BEFORE DELETE ON sessions FOR EACH ROW
BEGIN IF COALESCE(@feelia_allow_hard_delete, 0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'hard delete disabled (feelia LAW-010)'; END IF; END$$
CREATE TRIGGER trg_nohard_session_notes BEFORE DELETE ON session_notes FOR EACH ROW
BEGIN IF COALESCE(@feelia_allow_hard_delete, 0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'hard delete disabled (feelia LAW-010)'; END IF; END$$
CREATE TRIGGER trg_nohard_session_audio BEFORE DELETE ON session_audio FOR EACH ROW
BEGIN IF COALESCE(@feelia_allow_hard_delete, 0) <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'hard delete disabled (feelia LAW-010)'; END IF; END$$
DELIMITER ;
-- نکته: DELETE والد (therapists/clients/sessions) مسدود می‌شود ⇒ cascadeِ فرزندان هرگز شروع نمی‌شود.
-- جاروب‌هایِ ALLOW_HARD_DELETE=1 و fixtureهایِ تست (test:api) باید قبل از DELETE همین متغیر را روی همان اتصال بگذارند.
