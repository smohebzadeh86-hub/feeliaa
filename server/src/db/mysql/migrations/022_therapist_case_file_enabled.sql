-- محدودسازیِ فیچرِ AI Case File به یک تراپیستِ مشخص در فازِ اولِ deploy
-- (تصمیمِ صریحِ مالک، ۲۰۲۶-۰۹-۲۳). پیش‌فرض خاموش برایِ همه؛ روشن‌کردن برایِ یک تراپیستِ
-- خاص با UPDATE دستیِ یک‌بار (نه از UI — هنوز پنلِ ادمین کنترلی برایِ این ندارد).
ALTER TABLE therapists ADD COLUMN case_file_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER case_file_auto_generate;
