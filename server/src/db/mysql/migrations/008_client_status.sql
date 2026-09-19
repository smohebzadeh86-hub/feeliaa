-- معادلِ MySQLِ 008_client_status.sql.
-- توجه: مقادیرِ اولیه‌ی category شاملِ 'adult-f'/'adult-m' هم می‌شود (009 آن‌ها را
-- به 'adult' + gender تبدیل می‌کند)، پس CHECK اینجا هنوز آن دو مقدار را هم می‌پذیرد.
ALTER TABLE clients ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE clients ADD COLUMN status_reason TEXT NULL;
ALTER TABLE clients ADD COLUMN category VARCHAR(16) NULL;

ALTER TABLE clients ADD CONSTRAINT clients_status_check CHECK (status IN ('active','inactive'));
ALTER TABLE clients ADD CONSTRAINT clients_category_check
  CHECK (category IS NULL OR category IN ('child','teen','adult-f','adult-m'));

CREATE INDEX idx_clients_status ON clients(therapist_id, status);
