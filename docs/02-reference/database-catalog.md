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
| source | TEXT NOT NULL | پیش‌فرض `'durable'`؛ `'offline'` رزرو |
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

## ۳. Enumها (مقادیرِ واقعی در کد)

| فیلد | مقادیر | نویسنده‌ها |
|---|---|---|
| `sessions.status` | `in_progress`، `recovered`، `completed`، `canceled` | `POST /api/sessions`، `PUT` (آزاد)، `ws/transcription.ts` |
| `sessions.batch_status` | `queued`، `processing`، `done`، `failed`، null | `stt/batchqueue.ts` |
| `sessions.stt_mode` | `realtime`، `batch`، `batch-pending`، `realtime-unreliable-noaudio`، null | `feelia-rt.js`، `batchqueue.ts` |
| `session_notes.type` | `note_during`، `note_after`، `sign`، `voice` | UI، batch/voice-note |
| `session_notes.sign_type` | `گریان`، `لرزش`، `تنش عضلانی`، `سکوت طولانی`، `خشم`، `پرخاشگری`، `اتصال چشمی گریزان`، `خواب‌آلودگی`، `بی‌قراری` | `.sign-chip[data-sign]` |
| `clients.status_reason` (UI) | `ناتوانی مالی`، `ظرفیت روحی/زمانی`، `روند تکمیل شد`، `سایر` + متنِ آزاد؛ «نامشخص» → null (فقط در ساختِ مراجع از تبِ غیرفعال)؛ سرور trim و حداکثر ۲۰۰ کاراکتر | `deactivateClientModal`، `newClientModal` |
| `sessions.source` | `live`، `manual` | `POST /api/sessions` (`mode`) |
| `session_audio.source` | `durable` (و `offline` در type) | `sessionAudioArchive.ts` |
| `client_case_file.status` | `ready`، `generating`، `error`، `stale` | `features/case-file/adapters/repository/caseFileRepository.sql.ts` |

## ۴. کوئری‌های حساس به عملکرد
- `GET /api/clients` و `/api/admin/therapists`: `LEFT JOIN` + `GROUP BY` روی همه‌ی جلسات.
- `/api/admin/export`: حلقه‌ی N+1 روی تراپیست‌ها، همه در حافظه.
- `query()` کوئری‌های >100ms را لاگ می‌کند (۶۰ کاراکترِ اولِ SQL، بدونِ پارامتر).
