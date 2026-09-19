-- معادلِ MySQLِ 005_therapist_phone.sql.
-- توجه: در MySQL هر NULL در UNIQUE KEY جداگانه شمرده می‌شود (رفتارِ پیش‌فرض)،
-- پس UNIQUE سادهٔ روی phone دقیقاً معادلِ ایندکسِ جزئیِ Postgres (`WHERE phone IS NOT NULL`) است.
ALTER TABLE therapists ADD COLUMN phone VARCHAR(20) NULL;
ALTER TABLE therapists MODIFY COLUMN email VARCHAR(255) NULL;
CREATE UNIQUE INDEX uq_therapists_phone ON therapists(phone);
