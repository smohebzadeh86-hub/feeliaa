-- معادلِ MySQLِ 009_client_gender.sql — داده‌تغییردهنده (LAW-007): قبل از اجرا روی
-- production از جدولِ clients backup بگیرید. منطقاً با نسخه‌ی Postgres یکسان است
-- (بدونِ نیاز به loop/procedure — فقط دو UPDATEِ ساده).
ALTER TABLE clients ADD COLUMN gender VARCHAR(4) NULL;

UPDATE clients SET gender = 'f', category = 'adult' WHERE category = 'adult-f';
UPDATE clients SET gender = 'm', category = 'adult' WHERE category = 'adult-m';

ALTER TABLE clients DROP CONSTRAINT clients_category_check;
ALTER TABLE clients ADD CONSTRAINT clients_category_check
  CHECK (category IS NULL OR category IN ('child','teen','adult'));

ALTER TABLE clients ADD CONSTRAINT clients_gender_check
  CHECK (gender IS NULL OR gender IN ('f','m'));
