# Database Catalog

> **وضعیت:** ACTIVE-CANONICAL (مالکِ جداول/ستون‌ها/enumها) · منبعِ ساختار برایِ MySQL (فعلاً
> مرجعِ production، از 2026-09-16): `server/src/db/mysql/schema.sql` +
> `server/src/db/mysql/migrations/001–015` · مدل و چرخه‌ی عمر: [data-architecture](../01-architecture/data-architecture.md).
> 🔴 **Production الان MySQL است، نه Postgres** (Cutoverِ 2026-09-16، به دستورِ صریحِ مالک —
> جزئیاتِ کاملِ عملیات در PROJECT_STATUS §7، رویدادِ «Cutoverِ واقعیِ production»). سرور:
> `feelia.ir` / `185.110.191.126`، پروسه‌ی pm2ِ `feelia-mysql`، دیتابیسِ `feelia` روی MySQL
> 8.4.11 (نصب‌شده با apt، سرویسِ systemd). دیتای واقعی کپی شد (۸ تراپیست/۱۲ مراجع/۱۸
> جلسه/۲۴ یادداشت/۱۲ ردیفِ صدا/۱۱ auth_session — شمارش‌ها با Postgres دقیقاً یکی بود).
> **مسیرِ Postgres (`server/src/db/migrations/001–014`، پایینِ همین فایل) کاملاً دست‌نخورده و
> تاریخچه‌ی canonical باقی می‌ماند** — کدِ قدیمی (`/root/feeliaa` روی سرور) و خودِ دیتابیسِ
> Postgres برایِ rollbackِ فوری نگه داشته شده‌اند (`pm2 stop feelia-mysql && pm2 start feelia`).
> بک‌آپِ کاملِ Postgresِ production: `/root/backups/feelia-postgres-production-backup-2026-09-16.sql`
> (روی خودِ سرور، هرگز به بیرون منتقل نشد — LAW-001/PII).
> تصمیم‌های ترجمه‌ی دیالکت (UUID→CHAR(36)، TIMESTAMPTZ→DATETIME، JSONB→JSON، ایندکسِ جزئی
> حذف‌شده، …) در `server/src/db/mysql/schema.sql` مستند است؛ جداول/ستون‌ها/enumهای زیر همچنان
> مرجعِ منطقیِ صحیح‌اند (فقط نوعِ ستونِ فیزیکی فرق دارد).

## ۱. Migrationها

| فایل | git | خلاصه |
|---|---|---|
| `001_clients.sql` | tracked | `clients(id, code UNIQUE, alias, created_at)` |
| `002_sessions.sql` | tracked | `sessions` + `idx_sessions_client` |
| `003_notes.sql` | tracked | `session_notes` + `idx_notes_session` |
| `004_therapists.sql` | tracked | `therapists`، `auth_sessions`، `clients.therapist_id` |
| `005_therapist_phone.sql` | tracked | `therapists.phone` (unique جزئی)، email اختیاری |
| `006_admin.sql` | tracked | `is_admin`، `active` |
| `007_realtime.sql` | tracked | `transcript_version`، `realtime_reliable`، `stt_mode`، `batch_status` + index |
| `008_client_status.sql` | tracked (`2763414`) | `clients.status`، `status_reason`، `category` + CHECKها + index |
| `009_client_gender.sql` | tracked (`2763414`) | `clients.gender`؛ **تبدیلِ داده** `adult-f/m → adult`+gender؛ CHECKها |
| `010_therapist_specialty.sql` | tracked (`2763414`) | `therapists.specialty` |
| `011_session_audio.sql` | tracked (`2763414`) | جدولِ `session_audio` + indexها |
| `012_session_source.sql` | tracked (`54a17fd`) | `sessions.source` (`live`/`manual`، پیش‌فرض `'live'`) + CHECK `sessions_source_check` — افزودنیِ خالص |
| `013_session_date_jalali.sql` | tracked (`54a17fd`) | **تبدیلِ داده:** `sessions.date` → شمسیِ `YYYY/MM/DD` با ارقامِ لاتین (میلادی با سال ≥ ۱۷۰۰ تبدیل، شمسیِ نانرمال صفرپُر، الگوهای دیگر دست‌نخورده)؛ `DO` block، idempotent؛ تأییدِ مالک 2026-09-14 |
| `014_session_date_optional.sql` | tracked (`54a17fd`) | `sessions.date DROP NOT NULL` — فقط جلسه‌ی `source=manual` بدونِ تاریخِ ورودی می‌تواند `NULL` بماند («بدونِ تاریخ»، تصمیمِ مالک)؛ افزودنیِ خالص، هیچ ردیفِ موجودی تغییر نمی‌کند |
| `015_client_pinned.sql` | tracked، **فقط MySQL** (`server/src/db/mysql/migrations/`؛ سیستمِ زنده دیگر `server/src/db/migrations/`ِ Postgres را اجرا نمی‌کند) | `clients.pinned_at DATETIME NULL` — سنجاقِ مراجع به صفحه‌ی اول («نمای امروز»)؛ افزودنیِ خالص. روی MySQLِ لوکالِ واقعی اعمال و با `SHOW COLUMNS` تأیید شد (2026-09-16) |
| `016_session_audio_duration.sql` | tracked، **فقط MySQL** | `session_audio.duration_ms INT NULL` — افزودنیِ خالص؛ رفعِ باگِ نمایشِ `0:00` در پخش‌کننده‌ی پنلِ ادمین (جزئیات: [subsystem ۰۵](../07-subsystems/05-session-audio-archive-speaker-resolve.md)). روی MySQLِ لوکالِ واقعی اعمال و با `DESCRIBE` تأیید شد (2026-09-16) |
| `017_session_audio_run_kind_sha.sql` | **commitنشده**، فقط MySQL | `session_audio.run_id VARCHAR(64) DEFAULT 'legacy'`، `kind VARCHAR(8) DEFAULT 'session'`، `sha256 CHAR(64) NULL`؛ `UNIQUE(session_id, seq)` قدیمی حذف و با `UNIQUE(session_id, run_id, seq)` + `UNIQUE(session_id, sha256)` جایگزین شد — رفعِ باگِ بحرانیِ بازنویسیِ بی‌صدا (seq از کلاینت می‌اومد و runهای مختلف از ۰ شروع می‌کردن). ✅ **رویِ MySQLِ لوکالِ واقعی اعمال و تأیید شد** (2026-09-16): `DESCRIBE`/`SHOW INDEX` + idempotencyِ سطحِ statement (errno 1060/1091/1061) + سناریویِ دو-run/seq=0 با curlِ واقعی — جزئیات: [verification](../../verification/2026-09-16-audio-durability-stage1.md) |
| `018_client_case_file.sql` | **commitنشده**، فقط MySQL | جدولِ جدیدِ `client_case_file` (پرونده‌ی روندِ درمان — AI Case File)؛ افزودنیِ خالص. ✅ **رویِ یک MySQLِ لوکالِ تازه (standalone، init‌شده در همین نشست) اعمال و با `DESCRIBE` تأیید شد**؛ تستِ end-to-endِ واقعی (regenerate با OpenRouterِ واقعی) هم موفق بود — جزئیات: [verification](../../verification/2026-09-17-ai-case-file-real-e2e.md) |
| `019_case_file_corpus_signature.sql` | **commitنشده**، فقط MySQL | دو ستونِ `corpus_signature`/`generating_started_at` به `client_case_file` (افزودنیِ خالص). ✅ رویِ MySQLِ standaloneِ لوکال apply شد (خودکار، تنها با ری‌استارتِ `tsx watch` بعدِ ذخیره‌ی فایل‌ها) و با `DESCRIBE` تأیید شد؛ end-to-endِ واقعی (regenerate با OpenRouترِ واقعی، شاملِ سناریوهایِ skip/race-409/force-400) هم موفق بود — جزئیات: [verification](../../verification/2026-09-17-case-file-corpus-signature-and-race-lock.md) |
| `020_therapist_case_file_auto_generate.sql` | **commitنشده**، فقط MySQL | ستونِ `therapists.case_file_auto_generate BOOLEAN NULL` — تنظیمِ سه‌حالته‌ی سطحِ‌تراپیست برایِ خودکارسازیِ تولیدِ پرونده بعدِ پایانِ جلسه (فازِ ۲ِ Module 08؛ `NULL`=هنوز پرسیده نشده، `TRUE`/`FALSE`=پاسخِ صریح، همیشه قابلِ‌تغییر). افزودنیِ خالص. ✅ رویِ MySQLِ standaloneِ لوکال apply شد (خودکار با ری‌استارتِ `tsx watch`) و با لاگِ migration runner تأیید شد؛ end-to-endِ واقعی (auto-trigger با OpenRouترِ واقعی روی یک مراجعِ canaryِ غیرفعال + تأییدِ خاموش/روشنِ toggle) هم موفق بود — جزئیات: [verification](../../verification/2026-09-18-case-file-auto-trigger-and-style-fixes.md) |
| `021_observability_events.sql` | **commitنشده**، فقط MySQL | دو جدولِ جدیدِ `obs_events`/`obs_ui_events` — لایه‌ی رصد/حسابرسیِ فازِ ۱ (پلنِ تأییدشده‌ی مالک، 2026-09-22). افزودنیِ خالص، بدونِ لمسِ جدولِ موجود. ✅ رویِ MySQLِ لوکالِ dev اعمال شد (خودکار، با ری‌استارتِ `tsx watch` بعدِ ذخیره‌ی فایل)؛ با `DESCRIBE`/`_migrations` و اجرایِ مجددِ دستیِ همان دو `CREATE TABLE IF NOT EXISTS` (بدونِ خطا) تأیید شد. جزئیات: بخشِ ۲.۱ همین فایل. |

| `022_therapist_case_file_enabled.sql` | tracked، فقط MySQL | `therapists.case_file_enabled` (نگاه کنید به PROJECT_STATUS) |
| `023_audio_upload_pipeline.sql` | **commitنشده**، فقط MySQL (2026-09-23) | سه جدولِ جدید `audio_uploads`، `audio_jobs`، `notifications` ([subsystem 06](../07-subsystems/06-audio-upload-pipeline.md))؛ `session_audio.transcribed_at` (رفعِ F1)؛ `client_case_file.content_version` (رفعِ F6)؛ CHECKِ `sessions_source_check` حالا `live\|manual\|upload` (DROP + ADD — errno 3821 در `migrate.ts` قابلِ چشم‌پوشی شد). افزودنی؛ هیچ ردیفِ موجودی تغییر نمی‌کند. ✅ رویِ MySQLِ لوکالِ dev با startِ سرور اعمال شد و با `information_schema` تأیید شد (جدول‌ها، ستون‌ها، CHECKها) |
| `024_client_recording_consent.sql` | commitنشده، فقط MySQL (2026-09-24)؛ **رویِ production اعمال شد 2026-09-25** (backupِ DB پیش از آن) | `clients.recording_consent_at DATETIME NULL` — رضایتِ یک‌باره برایِ هر مراجع (دستورِ مالک). افزودنی، بدونِ backfill (رضایتِ «همان جلسه»ی قدیمی دائمی تفسیر نمی‌شود). ✅ رویِ MySQLِ dev اعمال و با E2E تأیید شد |
| `025_upload_multi_part.sql` | commitنشده، فقط MySQL (2026-09-25)؛ ✅ **رویِ MySQLِ dev اعمال شد** (E2E، با `information_schema` تأیید)؛ ✅ **رویِ production اعمال شد 2026-09-25** (deployِ `45b0482`، backupِ DB `feelia-pre-025-*` پیش از آن) | آپلودِ چندبخشی برایِ یک جلسه: `audio_uploads.group_id CHAR(36)`، `part_index INT`، `parts_total INT`، `duration_ms INT` (همه NULL‌پذیر) + index `idx_audio_uploads_group (therapist_id, group_id)`؛ `audio_jobs.source_parts TEXT` (JSONِ `[{uploadId, path}]`). افزودنی، بدونِ backfill؛ آپلودِ تک‌فایلی بدونِ تغییر (همه NULL) |

جدولِ سیستمی: `_migrations(id SERIAL, name TEXT UNIQUE, applied_at TIMESTAMPTZ)` — ساخته‌شده در `migrate.ts` (نسخه‌ی Postgres؛ معادلِ MySQL همان نقش را با `AUTO_INCREMENT`/`DATETIME` دارد — بخشِ ۲ همین فایل را برایِ وضعیتِ فعلیِ دوگانگیِ schema ببینید).

## ۲. جداول

### `therapists`
| ستون | نوع | null | پیش‌فرض | قید/نکته |
|---|---|---|---|---|
| id | UUID | no | `gen_random_uuid()` | PK |
| email | TEXT | yes | — | UNIQUE؛ lowercase در register |
| password_hash | TEXT | no | — | `saltHex:hashHex` (scrypt، 64 بایت) |
| name | TEXT | yes | — | |
| created_at | TIMESTAMPTZ | no | now() | |
| phone | TEXT | yes | — | `therapists_phone_unique` WHERE NOT NULL؛ فرمتِ `09XXXXXXXXX` در اپ |
| is_admin | BOOLEAN | no | false | |
| active | BOOLEAN | no | true | false → همه‌ی درخواست‌ها بی‌نشست |
| specialty | TEXT | yes | — | (010) |
| case_file_auto_generate | BOOLEAN | yes | NULL | (020) سه‌حالته: NULL=هنوز پرسیده نشده، TRUE/FALSE=پاسخِ صریح — خودکارسازیِ تولیدِ پرونده بعدِ پایانِ جلسه (فقط مراجعینِ inactive، فعلاً) |

### `auth_sessions`
| ستون | نوع | نکته |
|---|---|---|
| token_hash | TEXT PK | SHA-256 hex توکنِ ۳۲ بایتی |
| therapist_id | UUID FK → therapists ON DELETE CASCADE | index `idx_auth_sessions_therapist` |
| created_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ NOT NULL | +۳۰ روز؛ پاکسازی ندارد |

### `clients`
| ستون | نوع | null | پیش‌فرض | قید |
|---|---|---|---|---|
| id | UUID | no | gen_random_uuid() | PK |
| code | TEXT | no | — | UNIQUE سراسری؛ `CL-` + ۴ کاراکتر از `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` |
| alias | TEXT | yes | | |
| created_at | TIMESTAMPTZ | no | now() | |
| therapist_id | UUID | **yes** | | FK ON DELETE CASCADE؛ `idx_clients_therapist` |
| status | TEXT | no | `'active'` | CHECK `active|inactive`؛ `idx_clients_status(therapist_id,status)` |
| status_reason | TEXT | yes | | فقط وقتی inactive |
| category | TEXT | yes | | CHECK `child|teen|adult` (بعد از 009) |
| gender | TEXT | yes | | CHECK `f|m`؛ اپ فقط برای teen/adult |
| pinned_at | DATETIME | yes | | بعد از 015 (فقط MySQL)؛ غیرِnull یعنی سنجاق‌شده به صفحه‌ی اول؛ با `status→inactive` خودکار null می‌شود |
| recording_consent_at | DATETIME | yes | | بعد از 024 (2026-09-24)؛ زمانِ **اولین** رضایتِ صریحِ ضبط/رونویسی (جلسه‌ی زنده یا آپلود) — «یک بار برایِ هر مراجع». NULL = پرسیده می‌شود. لغو ⇒ NULL. بدونِ backfill |

### `sessions`
| ستون | نوع | null | پیش‌فرض | نکته |
|---|---|---|---|---|
| id | UUID | no | gen_random_uuid() | PK |
| client_id | UUID | no | | FK → clients CASCADE |
| session_num | INTEGER | no | | UNIQUE(client_id, session_num)؛ `MAX+1` (غیراتمیک) |
| date | TEXT | **yes** (014) | | شمسیِ `YYYY/MM/DD` با ارقامِ لاتین (نرمال‌سازی و اعتبارسنجی در `http/sessionDate.ts`؛ داده‌ی قبلی با 013)؛ `NULL` فقط برایِ `source=manual` بدونِ تاریخِ ورودی («بدونِ تاریخ»)؛ جلسه‌ی `live` همیشه مقدار دارد (fallback به وقتِ ایران)؛ `MAX(date)` = آخرین جلسه (NULLها نادیده گرفته می‌شوند) |
| start_time | TEXT | no | | `HH:MM` با ارقامِ لاتین |
| consent | BOOLEAN | no | false | جلسه‌ی زنده همیشه `true`؛ جلسه‌ی `source=manual` (بدونِ ضبط) `false` |
| duration_ms | INTEGER | yes | | هر ۱۰s از UI |
| status | TEXT | no | `'in_progress'` | enum زیر؛ بدونِ CHECK |
| transcript | TEXT | yes | | متنِ جلسه (حساس) |
| anchors | JSONB | yes | | `[{chars, off}]` — در فرانتِ فعلی نویسنده‌ای پیدا نشد |
| txt_content | TEXT | yes | | استفاده در کدِ فعلی پیدا نشد |
| created_at / updated_at | TIMESTAMPTZ | no | now() | |
| transcript_version | INTEGER | no | 0 | CAS (007) |
| realtime_reliable | BOOLEAN | yes | | |
| stt_mode | TEXT | yes | | enum زیر |
| batch_status | TEXT | yes | | enum زیر؛ `idx_sessions_batch` جزئی |
| source | TEXT | no | `'live'` | CHECK `live|manual` (012)؛ `manual` = ثبتِ دستیِ جلسه‌ی گذشته، بدونِ صدا/رونویسی |

### `session_notes`
| ستون | نوع | نکته |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions CASCADE | `idx_notes_session(session_id, offset_ms)` |
| type | TEXT NOT NULL | enum زیر؛ بدونِ CHECK |
| text | TEXT | متنِ یادداشت (حساس) |
| sign_type | TEXT | برچسبِ فارسیِ علامت |
| offset_ms | INTEGER | زمان نسبت به شروعِ جلسه |
| wall_clock | TEXT | ساعتِ محلی `fa-IR` |
| created_at | TIMESTAMPTZ | |

### `session_audio` (011 + 016 + 017)
| ستون | نوع | نکته |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions CASCADE | |
| seq | INTEGER NOT NULL | **(017)** دیگر از کلاینت نمی‌آید — سرور زیرِ قفلِ per-session، `MAX(seq)+1` همان جلسه تعیین می‌کند؛ هرگز overwrite نمی‌شود. `UNIQUE(session_id, run_id, seq)` |
| run_id | VARCHAR(64) | **(017)** شناسه‌ی RTSessionِ کلاینت (هر start/resume یکی تازه)؛ پیش‌فرض `'legacy'` برایِ ردیف‌هایِ قبل از 017 |
| kind | VARCHAR(8) | **(017)** `'session'` یا `'note'` — فقط برایِ نمایش/فیلترِ پنلِ ادمین |
| sha256 | CHAR(64) NULL | **(017)** hashِ بایت‌های فایل؛ `UNIQUE(session_id, sha256)` باعثِ idempotent‌بودنِ retryِ همان آپلود می‌شود (بدونِ ردیفِ تکراری) |
| path | TEXT NOT NULL | مسیرِ مطلقِ فایل روی دیسکِ سرور |
| bytes | INTEGER NOT NULL | |
| mime | TEXT | |
| source | TEXT NOT NULL | پیش‌فرض `'durable'`؛ `'offline'` رزرو؛ **`'upload'` (023)** برایِ نسخه‌ی نرمال‌شده‌ی فایلِ آپلودی |
| transcribed_at | DATETIME NULL | **(023، رفعِ F1)** زمانی که متنِ همین بایت‌ها (session+sha256) در صفِ batch اعمال شد — تضمینِ exactly-once؛ ردیف‌هایِ قبل از 023 `NULL` |
| duration_ms | INTEGER NULL | **(016، 2026-09-16)** از ری‌ماکسِ ffmpeg هنگامِ آرشیو؛ `NULL` اگر ffmpeg نبود/خطا داد یا سگمنت قبل از 016 آرشیو شده — بدونِ backfill خودکار |
| created_at | TIMESTAMPTZ | `idx_session_audio_created` برای sweep |

### `client_case_file` (018) — پرونده‌ی روندِ درمان (AI Case File)
| ستون | نوع | null | پیش‌فرض | نکته |
|---|---|---|---|---|
| client_id | CHAR(36) | no | | PK؛ FK → clients ON DELETE CASCADE؛ یک ردیف به‌ازایِ هر مراجع |
| content | JSON | no | | `CaseFileContent` — schemaِ کامل در `server/src/features/case-file/domain/types.ts`؛ snapshotِ مستقل از `sessions.transcript`/`session_notes` (یک‌طرفه: خام→سنتز، هرگز برعکس) |
| status | VARCHAR(16) | no | `'ready'` | CHECK `ready\|generating\|error\|stale` |
| generating_started_at (019) | DATETIME | yes | | زمانِ شروعِ آخرین `markGenerating` — قفلِ نرمِ ۳دقیقه‌ای برایِ جلوگیری از race بینِ دو regenerateِ هم‌زمان (`generateCaseFile.ts`) |
| model | VARCHAR(64) | yes | | مقدارِ واقعیِ `OPENAI_CASE_FILE_MODEL`/`OPENROUTER_MODEL` در لحظه‌ی generation — هیچ مدلی در کد hardcode نشده |
| prompt_version | INT | no | 1 | برایِ ردیابیِ تغییرِ system prompt در آینده |
| generated_at | DATETIME | yes | | آخرین regeneration موفق |
| generated_from_session_id | CHAR(36) | yes | | **عمداً بدونِ FK سخت** — حذفِ آن session نباید پرونده را نامعتبر/CASCADE-حذف کند (فقط یک نشانه‌ی snapshot است) |
| corpus_signature (019) | VARCHAR(255) | yes | | امضایِ سبکِ کورپوس در لحظه‌ی آخرین تولید (`sessionCount:latestSessionId:noteCount:latestSessionUpdate:latestNoteCreated`) — regenerate بدونِ `force` وقتی امضا با کورپوسِ فعلی یکسان باشد، بدونِ فراخوانیِ LLM رد می‌شود |
| therapist_edited_at | DATETIME | yes | | آخرین PATCH دستیِ تراپیست |
| force_regenerated_at / force_regenerated_by | DATETIME / CHAR(36) | yes | | فقط وقتی `force=true` در regenerate — لاگِ عملِ خطرناکِ «دورریختنِ همه‌ی تاییدها» |
| error_message | TEXT | yes | | آخرین خطای `CaseFileGenerationError` |
| content_version (023) | INT | no | 0 | CAS رویِ `content` — هر نوشتن +۱؛ تولید و PATCHها با `WHERE content_version = ?` می‌نویسند (رفعِ F6) |

### `audio_uploads` / `audio_jobs` / `notifications` (023) — آپلودِ فایلِ صوتیِ جلسه

| جدول | ستون‌هایِ کلیدی | نکته |
|---|---|---|
| `audio_uploads` | `id` PK، `therapist_id`/`client_id` FK CASCADE، `session_id` FK CASCADE (بعد از complete)، `fingerprint`، `original_name` (sanitize، فقط نمایش)، `size_bytes BIGINT`، `chunk_size`، `chunks_total`، `session_date`، `status` CHECK `uploading\|complete\|failed\|canceled`، `error_code`؛ (025) `group_id`، `part_index`، `parts_total`، `duration_ms` — بخشِ `complete` با `session_id` NULL = بخشِ رسیده‌ی منتظرِ بقیه‌ی گروه | تکه‌ها رویِ دیسک (`data/uploads/<id>/`)، نه DB. index `(therapist_id, fingerprint)` برایِ dedupe/ادامه، `(therapist_id, group_id)` برایِ گروه |
| `audio_jobs` | `id` PK، `upload_id` UNIQUE FK، `session_id`/`client_id`/`therapist_id` FK CASCADE، `stage` CHECK `queued\|normalizing\|transcribing\|case_file\|done\|failed`، `attempts`، `next_attempt_at`، `locked_until` (lease)، `source_path`، `source_parts` (025، JSONِ بخش‌ها به ترتیب؛ `upload_id` = بخشِ ۰)، `normalized_path`، `duration_ms`، `soniox_file_id`، `soniox_transcription_id`، `transcription_started_at`، `transcript_applied_at` (exactly-once)، `transcript_chars`، `case_file_status` (`running\|waiting\|done\|failed\|skipped\|not_applicable\|busy_gave_up`)، `error_code`، `finished_at` | index `(stage, next_attempt_at)` برایِ worker |
| `notifications` | `id` PK، `therapist_id` FK، `kind` (`transcript_ready\|transcript_empty\|processing_failed\|case_file_updated\|case_file_failed`)، `client_id`/`session_id` FK CASCADE، `job_id`، `error_code`، `read_at` | `UNIQUE(job_id, kind)` ⇒ retry اعلانِ تکراری نمی‌سازد. **بدونِ متنِ بالینی** (فقط kind + شناسه). نگهداری ۳۰ روز |

### ۲.۱ `obs_events` / `obs_ui_events` (021) — لایه‌ی رصد/حسابرسی، فازِ ۱

**تصمیم‌هایِ عمدیِ مغایر با بقیه‌ی schema** (به‌جایِ CHAR(36) UUID + FK که باقیِ جداول دارند):
- **PK از نوعِ `BIGINT AUTO_INCREMENT`**، نه UUID — این دو جدول فقط insert-محورند و هیچ‌جا با
  UUIDِ سمتِ کلاینت ارجاع داده نمی‌شوند؛ BIGINT ارزان‌تر و برایِ ایندکسِ `ts`/`id` کافی است.
- **بدونِ هیچ `FOREIGN KEY`** به `therapists`/`clients`/`sessions` — این جدول یک firehoseِ
  فایراندفورگت است؛ یک insert که با errno 1452 (فقدانِ ردیفِ والد، مثلاً race بینِ خواندنِ
  ownership و نوشتنِ obs) fail شود نباید مسیرِ اصلیِ کاربر را متوقف کند. مهم‌تر: طبقِ تصمیمِ D-E
  مالک ([project-laws §LAW-010](../00-governance/project-laws.md))، حذفِ تراپیست/مراجع/جلسه
  **نباید** ردِ حسابرسیِ مربوط به آن‌ها را هم پاک کند — بدونِ `ON DELETE CASCADE`، ردیف‌هایِ obs
  حتی بعدِ حذفِ رکوردِ اصلی زنده می‌مانند (فقط `therapist_id`/`session_id`شان دیگر به چیزی اشاره
  نمی‌کند، که عمدی است).

**`obs_events`** (رویدادهایِ ساختارمندِ سرور/کلاینت/job — retention ۱۸۰ روز، `OBS_EVENTS_RETENTION_DAYS`):
`id` BIGINT PK، `ts` DATETIME(3) (پیش‌فرضِ سرور، هرگز از کلاینت)، `client_ts` DATETIME(3) NULL،
`source` ENUM(`server`,`client`,`job`)، `severity` ENUM(`debug`,`info`,`warn`,`error`)،
`event` VARCHAR(64)، `code` VARCHAR(64) NULL، `therapist_id`/`client_id`/`session_id` CHAR(36) NULL
(بدونِ FK)، `run_id`/`request_id` VARCHAR(64) NULL، `nav_id` CHAR(36) NULL، `route` VARCHAR(128) NULL
(الگوی مسیر مثلِ `/api/sessions/:id`، نه URLِ خام)، `method` VARCHAR(8) NULL، `status_code` SMALLINT NULL،
`duration_ms` INT NULL، `detail` JSON NULL (فقط از `sanitizeDetail()` عبورکرده — LAW-001).
ایندکس‌ها: `(ts)`، `(therapist_id,ts)`، `(session_id,ts)`، `(event,ts)`، `(request_id)`.

**`obs_ui_events`** (فایرهوزِ کلیک/ناوبریِ خام — retention ۳۰ روز، `OBS_UI_RETENTION_DAYS`، بدونِ ستونِ JSON):
`id` BIGINT PK، `ts`/`client_ts`، `therapist_id`/`session_id` CHAR(36) NULL، `nav_id` CHAR(36)
(هر page-load یکی)، `seq` INT (شمارنده‌ی یکنواختِ همان nav_id)، `kind` ENUM(`click`,`nav`,`visibility`,`net`,`lifecycle`,`error`)،
`screen` VARCHAR(64) NULL، `target_id`/`target_role`/`target_tag` VARCHAR NULL (فقط `data-obs`/`id`،
`role`، `tagName`ِ عنصرِ کلیک‌شده — هرگز متن)، `value_num` INT NULL.
ایندکس‌ها: `(ts)`، `(therapist_id,ts)`، `(session_id,ts)`، `(nav_id,seq)`.

## ۳. Enumها (مقادیرِ واقعی در کد)

| فیلد | مقادیر | نویسنده‌ها |
|---|---|---|
| `sessions.status` | `in_progress`، `recovered`، `completed`، `canceled` | `POST /api/sessions`، `PUT` (آزاد)، `ws/transcription.ts` |
| `sessions.batch_status` | `queued`، `processing`، `done`، `failed`، null | `stt/batchqueue.ts` |
| `sessions.stt_mode` | `realtime`، `batch`، `batch-pending`، `realtime-unreliable-noaudio`، null | `feelia-rt.js`، `batchqueue.ts` |
| `session_notes.type` | `note_during`، `note_after`، `sign`، `voice` | UI، batch/voice-note |
| `session_notes.sign_type` | `گریان`، `لرزش`، `تنش عضلانی`، `سکوت طولانی`، `خشم`، `پرخاشگری`، `اتصال چشمی گریزان`، `خواب‌آلودگی`، `بی‌قراری` | `.sign-chip[data-sign]` |
| `clients.status_reason` (UI) | `ناتوانی مالی`، `ظرفیت روحی/زمانی`، `روند تکمیل شد`، `سایر` + متنِ آزاد؛ «نامشخص» → null (فقط در ساختِ مراجع از تبِ غیرفعال)؛ سرور trim و حداکثر ۲۰۰ کاراکتر | `deactivateClientModal`، `newClientModal` |
| `sessions.source` | `live`، `manual`، `upload` (023) | `POST /api/sessions` (`mode`)؛ `POST /api/uploads/:id/complete` |
| `sessions.stt_mode` (افزوده) | `upload` (023) | `jobRunner.ts` |
| `session_audio.source` | `durable`، `upload` (023) (و `offline` در type) | `sessionAudioArchive.ts` |
| `client_case_file.status` | `ready`، `generating`، `error`، `stale` | `features/case-file/adapters/repository/caseFileRepository.sql.ts` |

## ۴. کوئری‌های حساس به عملکرد
- `GET /api/clients` و `/api/admin/therapists`: `LEFT JOIN` + `GROUP BY` روی همه‌ی جلسات.
- `/api/admin/export`: حلقه‌ی N+1 روی تراپیست‌ها، همه در حافظه.
- `query()` کوئری‌های >100ms را لاگ می‌کند (۶۰ کاراکترِ اولِ SQL، بدونِ پارامتر).
