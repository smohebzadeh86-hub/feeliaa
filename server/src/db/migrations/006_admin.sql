-- نقش ادمین: همون حساب تراپیست، فقط با یه فلگ اضافه
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
