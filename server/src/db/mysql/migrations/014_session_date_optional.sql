-- معادلِ MySQLِ 014_session_date_optional.sql — تاریخِ جلسه اختیاری می‌شود (فقط
-- source='manual' می‌تواند NULL بماند)؛ افزودنی، هیچ ردیفِ موجودی تغییر نمی‌کند.
ALTER TABLE sessions MODIFY COLUMN date VARCHAR(10) NULL;
