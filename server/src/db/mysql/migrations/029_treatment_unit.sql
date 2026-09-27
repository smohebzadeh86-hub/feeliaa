-- واحدِ درمان (فردی/زوج/خانواده/کودک و والد) + زمینه‌ی جلسه — دستورِ مالک 2026-09-27.
-- اصل: هیچ نوع/نقش/رویکرد/واژه‌ای در کد hard-code نمی‌شود — همه کاتالوگِ داده‌محور در این جداول است
-- و فرانت فرم را از روی آن می‌سازد. افزودنِ نوعِ جدید = افزودنِ ردیف، نه deploy.
-- ⚠️ runner فایل را با کاراکترِ نقطه‌ویرگولِ لاتین تکه می‌کند، پس در هیچ متن یا کامنتی از آن استفاده نشود.
-- additive و بدونِ backfill: مراجعِ موجود unit_type = individual می‌گیرد و عضوِ ضمنی‌اش از clients.category/gender خوانده می‌شود.

CREATE TABLE IF NOT EXISTS tu_member_roles (
    code          VARCHAR(24)  NOT NULL PRIMARY KEY,
    label_fa      VARCHAR(48)  NOT NULL,
    gender        CHAR(1)      NULL,
    age_group     VARCHAR(8)   NULL,
    ask_age       BOOLEAN      NOT NULL DEFAULT FALSE,
    ask_gender    BOOLEAN      NOT NULL DEFAULT FALSE,
    context_label VARCHAR(64)  NOT NULL,
    sort          INT          NOT NULL DEFAULT 0,
    active        BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tu_unit_types (
    code            VARCHAR(24)  NOT NULL PRIMARY KEY,
    label_fa        VARCHAR(48)  NOT NULL,
    min_members     INT          NOT NULL DEFAULT 1,
    max_members     INT          NOT NULL DEFAULT 1,
    allowed_roles   JSON         NOT NULL,
    presets         JSON         NOT NULL,
    context_setting VARCHAR(255) NOT NULL,
    sort            INT          NOT NULL DEFAULT 0,
    active          BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tu_modalities (
    code          VARCHAR(24)  NOT NULL PRIMARY KEY,
    label_fa      VARCHAR(64)  NOT NULL,
    default_unit  VARCHAR(24)  NULL,
    context_label VARCHAR(128) NOT NULL,
    sort          INT          NOT NULL DEFAULT 0,
    active        BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tu_modality_terms (
    modality_code VARCHAR(24)  NOT NULL,
    term          VARCHAR(64)  NOT NULL,
    PRIMARY KEY (modality_code, term),
    CONSTRAINT fk_tu_terms_modality FOREIGN KEY (modality_code) REFERENCES tu_modalities(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_members (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    client_id   CHAR(36)    NOT NULL,
    role_code   VARCHAR(24) NOT NULL,
    alias       VARCHAR(80) NULL,
    category    VARCHAR(8)  NULL,
    gender      CHAR(1)     NULL,
    sort        INT         NOT NULL DEFAULT 0,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_client_members_client (client_id, sort),
    CONSTRAINT fk_client_members_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE clients ADD COLUMN unit_type VARCHAR(24) NOT NULL DEFAULT 'individual';
ALTER TABLE sessions ADD COLUMN attendees JSON NULL;
ALTER TABLE sessions ADD COLUMN pre_note TEXT NULL;
ALTER TABLE therapists ADD COLUMN modalities JSON NULL;

-- ===== seed (INSERT IGNORE: اجرای دوباره بی‌خطر، ویرایشِ بعدیِ ادمین بازنویسی نمی‌شود) =====
INSERT IGNORE INTO tu_member_roles (code, label_fa, gender, age_group, ask_age, ask_gender, context_label, sort) VALUES
 ('client',    'مراجع',  NULL, NULL,    TRUE,  TRUE,  'client',              10),
 ('partner_f', 'همسر',   'f',  'adult', FALSE, FALSE, 'adult woman (partner)', 20),
 ('partner_m', 'همسر',   'm',  'adult', FALSE, FALSE, 'adult man (partner)',   21),
 ('mother',    'مادر',   'f',  'adult', FALSE, FALSE, 'mother (adult woman)',  30),
 ('father',    'پدر',    'm',  'adult', FALSE, FALSE, 'father (adult man)',    31),
 ('daughter',  'دختر',   'f',  NULL,    TRUE,  FALSE, 'daughter',              40),
 ('son',       'پسر',    'm',  NULL,    TRUE,  FALSE, 'son',                   41),
 ('child',     'کودک',   NULL, 'child', FALSE, TRUE,  'child',                 45),
 ('other',     'دیگری',  NULL, NULL,    TRUE,  TRUE,  'family member',         90);

INSERT IGNORE INTO tu_unit_types (code, label_fa, min_members, max_members, allowed_roles, presets, context_setting, sort) VALUES
 ('individual', 'فردی', 1, 1,
  JSON_ARRAY('client'),
  JSON_ARRAY(JSON_OBJECT('key','one','label_fa','فردی','roles',JSON_ARRAY('client'),'default',TRUE)),
  'individual psychotherapy session', 10),
 ('couple', 'زوج', 2, 2,
  JSON_ARRAY('partner_f','partner_m'),
  JSON_ARRAY(
    JSON_OBJECT('key','fm','label_fa','زن و مرد','roles',JSON_ARRAY('partner_f','partner_m'),'default',TRUE),
    JSON_OBJECT('key','ff','label_fa','دو زن','roles',JSON_ARRAY('partner_f','partner_f'),'default',FALSE),
    JSON_OBJECT('key','mm','label_fa','دو مرد','roles',JSON_ARRAY('partner_m','partner_m'),'default',FALSE)),
  'couple therapy session', 20),
 ('family', 'خانواده', 2, 8,
  JSON_ARRAY('mother','father','daughter','son','other'),
  JSON_ARRAY(JSON_OBJECT('key','parents','label_fa','والدین','roles',JSON_ARRAY('mother','father'),'default',TRUE)),
  'family therapy session', 30),
 ('child_parent', 'کودک و والد', 2, 3,
  JSON_ARRAY('child','mother','father'),
  JSON_ARRAY(
    JSON_OBJECT('key','cm','label_fa','با مادر','roles',JSON_ARRAY('child','mother'),'default',TRUE),
    JSON_OBJECT('key','cf','label_fa','با پدر','roles',JSON_ARRAY('child','father'),'default',FALSE),
    JSON_OBJECT('key','cmf','label_fa','با هر دو','roles',JSON_ARRAY('child','mother','father'),'default',FALSE)),
  'child therapy session with parent(s) present', 40);

INSERT IGNORE INTO tu_modalities (code, label_fa, default_unit, context_label, sort) VALUES
 ('cbt',      'شناختی-رفتاری (CBT)',       NULL,       'cognitive behavioral therapy', 10),
 ('eft',      'هیجان‌مدار (EFT)',          'couple',   'emotionally focused therapy',  20),
 ('gottman',  'گاتمن',                      'couple',   'Gottman method couple therapy', 30),
 ('family_systems', 'خانواده‌درمانیِ سیستمی', 'family', 'systemic family therapy',      40),
 ('psychodynamic', 'روان‌پویشی',            NULL,       'psychodynamic therapy',        50),
 ('act',      'پذیرش و تعهد (ACT)',        NULL,       'acceptance and commitment therapy', 60),
 ('schema',   'طرحواره‌درمانی',             NULL,       'schema therapy',               70),
 ('play',     'بازی‌درمانی',                'child_parent', 'play therapy with a child', 80);

INSERT IGNORE INTO tu_modality_terms (modality_code, term) VALUES
 ('cbt','افکار خودآیند'),('cbt','تحریف شناختی'),('cbt','باور بنیادین'),('cbt','تکلیف خانگی'),('cbt','بازسازی شناختی'),
 ('eft','چرخه منفی'),('eft','دلبستگی'),('eft','هیجان اولیه'),('eft','هیجان ثانویه'),('eft','کناره‌گیری'),('eft','تعقیب‌کننده'),
 ('gottman','چهار سوار'),('gottman','انتقاد'),('gottman','تحقیر'),('gottman','حالت تدافعی'),('gottman','سنگ‌اندازی'),('gottman','نقشه عشق'),
 ('family_systems','مثلث‌سازی'),('family_systems','مرزها'),('family_systems','ائتلاف'),('family_systems','تمایزیافتگی'),
 ('psychodynamic','انتقال'),('psychodynamic','انتقال متقابل'),('psychodynamic','مکانیزم دفاعی'),('psychodynamic','ناهشیار'),
 ('act','گسلش شناختی'),('act','پذیرش'),('act','ارزش‌ها'),('act','ذهن‌آگاهی'),
 ('schema','طرحواره'),('schema','ذهنیت'),('schema','کودک آسیب‌پذیر'),('schema','والد تنبیه‌گر'),
 ('play','بازی‌درمانی'),('play','نقاشی'),('play','عروسک')
