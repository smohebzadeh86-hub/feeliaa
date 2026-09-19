-- سنجاقِ مراجع به صفحه‌ی اول (نمای «امروز»)؛ افزودنی، هیچ ردیفِ موجودی تغییر نمی‌کند.
ALTER TABLE clients ADD COLUMN pinned_at DATETIME NULL;
