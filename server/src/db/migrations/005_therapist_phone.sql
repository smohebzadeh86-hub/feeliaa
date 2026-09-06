-- شماره‌ی تلفن به‌عنوان شناسه‌ی اصلیِ ورود؛ ایمیل اختیاری شد (برای پیامک در آینده)
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE therapists ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS therapists_phone_unique ON therapists(phone) WHERE phone IS NOT NULL;
