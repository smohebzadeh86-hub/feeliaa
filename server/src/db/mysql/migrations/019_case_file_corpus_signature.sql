-- امضایِ کورپوس برایِ جلوگیری از regenerate الکی (بدونِ داده‌ی جدید) + قفلِ نرمِ generating
-- برایِ جلوگیری از race بینِ دو درخواستِ هم‌زمانِ regenerate.
ALTER TABLE client_case_file ADD COLUMN corpus_signature VARCHAR(255) NULL AFTER generated_from_session_id;
ALTER TABLE client_case_file ADD COLUMN generating_started_at DATETIME NULL AFTER status;
