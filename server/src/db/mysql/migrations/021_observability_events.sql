-- لایه‌ی رصد و حسابرسی — فاز ۱ (پلنِ تأییدشده‌ی مالک، 2026-09-22).
-- دو جدول: obs_events (رویدادهای ساختارمندِ سرور/کلاینت/job) و obs_ui_events
-- (فایرهوزِ کلیک/ناوبریِ خام، ستون‌های باریک، بدونِ JSON).
--
-- تصمیم‌های عمدیِ مغایر با بقیه‌ی schema (ثبت در database-catalog.md):
--  - PK از نوع BIGINT AUTO_INCREMENT است نه CHAR(36) UUID: این جدول‌ها فقط
--    insert-محورند و هیچ‌جا با UUID از سمتِ کلاینت ارجاع داده نمی‌شوند؛ BIGINT
--    ارزان‌تر و برایِ ایندکسِ ts/id کافی است.
--  - بدونِ FK به therapists/clients/sessions: این جدول یک firehoseِ فایراندفورگت
--    است — یک insert که با errno 1452 (فقدانِ سطرِ والد، مثلاً بینِ خواندنِ
--    ownership و نوشتنِ obs) fail شود نباید کارِ اصلی را متوقف کند. مهم‌تر: طبقِ
--    تصمیمِ D-E مالک، حذفِ تراپیست/مراجع نباید ردِ حسابرسیِ مربوط به آن‌ها را هم
--    پاک کند (بدونِ FK با ON DELETE CASCADE، ردیف‌هایِ obs زنده می‌مانند — فقط
--    ستونِ id مربوطه دیگر در جدولِ اصلی معنا ندارد، که عمدی است).
CREATE TABLE IF NOT EXISTS obs_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    client_ts DATETIME(3) NULL,
    source ENUM('server','client','job') NOT NULL,
    severity ENUM('debug','info','warn','error') NOT NULL DEFAULT 'info',
    event VARCHAR(64) NOT NULL,
    code VARCHAR(64) NULL,
    therapist_id CHAR(36) NULL,
    client_id CHAR(36) NULL,
    session_id CHAR(36) NULL,
    run_id VARCHAR(64) NULL,
    request_id VARCHAR(64) NULL,
    nav_id CHAR(36) NULL,
    route VARCHAR(128) NULL,
    method VARCHAR(8) NULL,
    status_code SMALLINT NULL,
    duration_ms INT NULL,
    detail JSON NULL,
    KEY idx_obs_events_ts (ts),
    KEY idx_obs_events_therapist_ts (therapist_id, ts),
    KEY idx_obs_events_session_ts (session_id, ts),
    KEY idx_obs_events_event_ts (event, ts),
    KEY idx_obs_events_request (request_id)
);

CREATE TABLE IF NOT EXISTS obs_ui_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    client_ts DATETIME(3) NULL,
    therapist_id CHAR(36) NULL,
    session_id CHAR(36) NULL,
    nav_id CHAR(36) NULL,
    seq INT NOT NULL,
    kind ENUM('click','nav','visibility','net','lifecycle','error') NOT NULL,
    screen VARCHAR(64) NULL,
    target_id VARCHAR(64) NULL,
    target_role VARCHAR(32) NULL,
    target_tag VARCHAR(16) NULL,
    value_num INT NULL,
    KEY idx_obs_ui_events_ts (ts),
    KEY idx_obs_ui_events_therapist_ts (therapist_id, ts),
    KEY idx_obs_ui_events_session_ts (session_id, ts),
    KEY idx_obs_ui_events_nav_seq (nav_id, seq)
);
