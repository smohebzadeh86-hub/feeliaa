ALTER TABLE clients ADD COLUMN IF NOT EXISTS gender TEXT;

-- داده‌ی قبلی: adult-f/adult-m جنسیت رو توی خودِ category حمل می‌کردن؛
-- حالا جنسیت یه فیلدِ مستقل و اختیاریه (چون قراره نوجوان هم جنسیت داشته باشه،
-- بدونِ تکرارِ ترکیب‌های category در قالبِ رشته‌های جدید).
UPDATE clients SET gender = 'f', category = 'adult' WHERE category = 'adult-f';
UPDATE clients SET gender = 'm', category = 'adult' WHERE category = 'adult-m';

ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_category_check;
ALTER TABLE clients ADD CONSTRAINT clients_category_check
  CHECK (category IS NULL OR category IN ('child','teen','adult'));

DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT clients_gender_check
    CHECK (gender IS NULL OR gender IN ('f','m'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
