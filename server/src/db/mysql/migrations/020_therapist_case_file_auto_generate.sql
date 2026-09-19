-- تنظیمِ سطحِ‌تراپیست برایِ خودکارسازیِ تولیدِ پرونده‌ی روندِ درمان بعدِ پایانِ جلسه
-- (فازِ ۲ِ Module 08 — docs/04-modules/08-ai-case-file/module-prd.md).
-- سه‌حالته: NULL = هنوز پرسیده نشده (مودالِ یک‌باره در UI نشان داده می‌شود)،
-- TRUE/FALSE = پاسخِ صریحِ تراپیست — همیشه بعداً از UI قابلِ‌تغییر.
ALTER TABLE therapists ADD COLUMN case_file_auto_generate BOOLEAN NULL AFTER specialty;
