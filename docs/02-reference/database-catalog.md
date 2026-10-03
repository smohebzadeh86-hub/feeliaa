# Database Catalog

> **وضعیت:** ACTIVE-CANONICAL (مالکِ جداول/ستون‌ها/enumها) · last-verified: 2026-09-30 @ `17d6919`
> **منبع:** `server/src/db/mysql/migrations/001–034` به ترتیبِ نام (اجرا در startup با `server/src/db/migrate.ts`؛ ثبت در `_migrations`).
> مدل، مالکیت و چرخه‌ی عمر: [data-architecture](../01-architecture/data-architecture.md). انضباط: [LAW-007](../00-governance/project-laws.md).
> DB زنده **MySQL** است (مهاجرت از Postgres در 2026-09-16، به دستورِ مالک — جزئیات در Event Log). وضعیتِ اعمالِ migrationها رویِ هر محیط فقط در `PROJECT_STATUS.md` نگه‌داری می‌شود (LAW-027).
> `server/src/db/migrations/001–014` نسخه‌ی **Postgresِ متروک** است (هیچ runnerِ زنده‌ای آن را اجرا نمی‌کند)؛ `server/src/db/mysql/schema.sql` snapshotِ دیالکتِ MySQL و تصمیم‌هایِ ترجمه (UUID→`CHAR(36)`، `TIMESTAMPTZ`→`DATETIME`، `JSONB`→`JSON`، ایندکسِ جزئی حذف) را مستند می‌کند. جداول/ستون‌هایِ زیر با نوعِ **منطقی** نوشته شده‌اند؛ نوعِ فیزیکیِ MySQL را از migration بخوانید.

## ۰. مالکِ هر جدول (LAW-025)

«مالک» = featureای که ساختار و بیشترِ نوشتن را دارد. featureهایِ دیگر فقط طبقِ ستونِ «نوشتنِ خارج از مالک» می‌نویسند (بدهیِ ماژولاریتی؛ backlog: API واحد).

| جدول | مالک | migration | نوشتنِ خارج از مالک | حساسیت |
|---|---|---|---|---|
| `_migrations` | platform `db` | (`migrate.ts`) | — | پایین |
| `therapists` | `auth` | 004، 005، 006، 010، 020، 022، 029، 031 | `admin` (فعال/ادمین/فلگ‌ها)، `case-file` (`case_file_auto_generate`)، `treatment-unit` (`modalities`) | بسیار بالا (PII) |
| `auth_sessions` | platform `auth/` | 004 | — | بالا |
| `clients` | `clients` | 001، 004، 008، 009، 015، 024، 029 | `admin` (حذف/فعال)، `treatment-unit` (`unit_type`) | بسیار بالا |
| `client_members` | `treatment-unit` | 029 | `clients` | بسیار بالا |
| `sessions` | `sessions` | 002، 007، 012، 013، 014، 023(CHECK)، 026، 029، 040 (`unit_type`، `modalities`: snapshotِ لحظه‌یِ ساخت)، 042 (`deleted_at`، `deleted_by`: حذفِ نرم) | ⚠️ `audio-upload` (`uploadSession.ts`، `jobStore.sql.ts`)، `transcription` (`stt.routes.ts`، `batch/`، `speakerResolve.ts`، `archive/`)، `legacy-ws`، `final-transcript`، `admin`، `treatment-unit`، `case-file`(خواندن) | بسیار بالا (متنِ جلسه) |
| `session_notes` | `sessions` (`notes.routes.ts`) | 003 | `transcription` (`batch/processQueue.ts`، `speakerResolve.ts`)، `sessions/voiceNote.legacy.ts`، `legacy-ws` | بسیار بالا |
| `session_audio` | `transcription` (`archive/`) | 011، 016، 017، 023، 027 | `admin` (حذف)، `sessions/autoClose.ts` | بسیار بالا (مسیرِ فایل) |
| `client_case_file` | `case-file` | 018، 019، 023 | — | بسیار بالا |
| `audio_uploads` | `audio-upload` | 023، 025 | `admin` (حذف) | بالا |
| `audio_jobs` | `audio-upload` | 023، 025، 033 | `admin` | بالا |
| `notifications` | `notifications` | 023 | `audio-upload` (ساخت از job) | متوسط (بدونِ متنِ بالینی) |
| `final_transcripts` | `final-transcript` | 031، 034 | `audio-upload` (پاکسازیِ یتیم/ارجاعِ Soniox) | بسیار بالا (متن) |
| `final_transcript_versions` | `final-transcript` | 037 | — (فقط `admin` از طریقِ `features/final-transcript/index.ts` می‌خواند) | بسیار بالا (متن) |
| `session_transcript_tokens` | `session-record` | 038، 041 (`covers_full`، `source_version`) | `audio-upload` (`jobStore.sql.ts`) و `final-transcript` (`runner.ts`) از طریقِ `saveCanonicalRecord` می‌نویسند | بسیار بالا (متنِ زمان‌دار؛ بعد از پاکسازیِ صدا می‌ماند) |
| `session_segments` | `session-record` | 041 | همان | بسیار بالا (نوبت‌هایِ گوینده) |
| `session_speaker_roles` | `session-record` | 041 | — | بالا (فقط نقش/برچسب) |
| `session_transcript_revisions` | `sessions` (`sessions.routes.ts`) | 040 | — | بسیار بالا (متنِ جایگزین‌شده) |
| `session_note_revisions` | `sessions` (`notes.routes.ts`) | 044 | — | بسیار بالا (متنِ قبلیِ یادداشت) |
| `client_case_file_versions` | `case-file` (`caseFileRepository.sql.ts`) | 044 | — | بسیار بالا (محتوایِ قبلیِ پرونده) |
| `session_audio_skips` | `transcription` (`archive/skips.ts`) | 039 | — | پایین (فقط شماره) |
| `tu_unit_types`، `tu_member_roles`، `tu_modalities`، `tu_modality_terms` | `treatment-unit` | 029، 030، 032 | — | پایین (کاتالوگ) |
| `obs_events`، `obs_ui_events` | platform `obs` | 021 | `admin` (خواندن/پاکسازی) | متوسط |
| `audit_log` | platform `obs` (`audit.ts`) | 028 | — | بالا |

## ۱. Migrationها

قاعده: additive مگر اینکه «تبدیلِ داده» نوشته شده باشد (LAW-007). ⚠️ runner فایل را با `;` تکه می‌کند — در متن/کامنتِ SQL هیچ `;` نگذارید (`test:tu`).

| فایل | خلاصه |
|---|---|
| `001_clients.sql` | `clients(id, code UNIQUE, alias, created_at)` |
| `002_sessions.sql` | `sessions` + `idx_sessions_client` |
| `003_notes.sql` | `session_notes` + `idx_notes_session` |
| `004_therapists.sql` | `therapists`، `auth_sessions`، `clients.therapist_id` |
| `005_therapist_phone.sql` | `therapists.phone` (unique)، email اختیاری |
| `006_admin.sql` | `is_admin`، `active` |
| `007_realtime.sql` | `transcript_version`، `realtime_reliable`، `stt_mode`، `batch_status` + index |
| `008_client_status.sql` | `clients.status`، `status_reason`، `category` + CHECKها + index |
| `009_client_gender.sql` | `clients.gender`؛ **تبدیلِ داده** `adult-f/m → adult`+gender؛ CHECKها |
| `010_therapist_specialty.sql` | `therapists.specialty` |
| `011_session_audio.sql` | جدولِ `session_audio` + indexها |
| `012_session_source.sql` | `sessions.source` (`live`/`manual`) + CHECK |
| `013_session_date_jalali.mjs` | **تبدیلِ داده:** `sessions.date` → شمسیِ `YYYY/MM/DD` (تأییدِ مالک 2026-09-14؛ idempotent؛ backup پیش از اجرا) |
| `014_session_date_optional.sql` | `sessions.date` NULL‌پذیر (فقط `source=manual`) |
| `015_client_pinned.sql` | `clients.pinned_at` (سنجاق به «نمای امروز») |
| `016_session_audio_duration.sql` | `session_audio.duration_ms` |
| `017_session_audio_run_kind_sha.sql` | `run_id`، `kind`، `sha256`؛ `UNIQUE(session_id,seq)` ⇒ `UNIQUE(session_id,run_id,seq)` + `UNIQUE(session_id,sha256)` (رفعِ بازنویسیِ بی‌صدا) |
| `018_client_case_file.sql` | جدولِ `client_case_file` |
| `019_case_file_corpus_signature.sql` | `corpus_signature`، `generating_started_at` |
| `020_therapist_case_file_auto_generate.sql` | `therapists.case_file_auto_generate` (سه‌حالته) |
| `021_observability_events.sql` | `obs_events`، `obs_ui_events` (بدونِ FK، LAW-010) |
| `022_therapist_case_file_enabled.sql` | `therapists.case_file_enabled` |
| `023_audio_upload_pipeline.sql` | `audio_uploads`، `audio_jobs`، `notifications`؛ `session_audio.transcribed_at`؛ `client_case_file.content_version`؛ CHECKِ `sessions_source_check` ⇒ `live|manual|upload` |
| `024_client_recording_consent.sql` | `clients.recording_consent_at` (رضایتِ یک‌باره، LAW-009؛ بدونِ backfill) |
| `025_upload_multi_part.sql` | `audio_uploads.group_id/part_index/parts_total/duration_ms`؛ `audio_jobs.source_parts` |
| `026_session_auto_close.sql` | `sessions.auto_closed_at` |
| `027_session_audio_client_seq.sql` | `session_audio.client_seq` (ترتیبِ پخش) |
| `028_audit_log.sql` | جدولِ `audit_log` (بدونِ FK) |
| `029_treatment_unit.sql` | `tu_*` (seed با `INSERT IGNORE`)، `client_members`، `clients.unit_type`، `sessions.attendees`، `sessions.pre_note`، `therapists.modalities` |
| `030_partner_role_labels.sql` | `UPDATE tu_member_roles`: «همسر» ⇒ «خانم»/«آقا» برایِ `partner_f`/`partner_m` (داده‌ی seed) |
| `031_final_transcript.sql` | `therapists.final_transcript_enabled`؛ جدولِ `final_transcripts` |
| `032_modality_dbt_pbt.sql` | seedِ مدالیته‌هایِ `dbt`/`pbt` + اصطلاحات |
| `033_upload_audio_quality.sql` | `audio_jobs.audio_quality/quality_warning/low_conf_ratio` |
| `034_final_transcript_turns.sql` | `final_transcripts.clean_turns` |
| `035_upload_pre_note.sql` | `audio_uploads.pre_note` (TEXT NULL؛ یادداشتِ متنیِ پیش از جلسه‌ی آپلود تا لحظه‌ی ساختِ جلسه؛ بعد از آن NULL و در `session_notes(note_before)` است) |
| `036_upload_transcript_metrics.sql` | `audio_jobs.transcript_metrics` (JSON NULL؛ «کیفیت به عدد»: پوشش/حفره/گوینده/اطمینان — فقط عدد و پرچم، بدونِ متن؛ [subsystem 06 §11](../07-subsystems/06-audio-upload-pipeline.md)) |
| `037_final_transcript_versions.sql` | جدولِ `final_transcript_versions` (تاریخچه‌ی فقط‌افزودنیِ «متنِ نهایی»؛ [subsystem 07](../07-subsystems/07-final-transcript.md)) |
| `038_session_transcript_tokens.sql` | جدولِ `session_transcript_tokens` (توکن‌هایِ زمان‌دارِ async ِSoniox به‌صورتِ JSONِ gzip، یک ردیف به ازایِ گذر؛ FK CASCADE با جلسه؛ [subsystem 08](../07-subsystems/08-session-record.md)) |
| `039_session_audio_skips.sql` | جدولِ `session_audio_skips` (سگمنت‌هایِ صوتیِ *خالی* که کلاینت گزارش می‌کند؛ ورودیِ چکِ «سگمنتی گم نشده» با `client_seq`؛ [subsystem 02](../07-subsystems/02-audio-durability-batch-fallback.md)) |
| `040_transcript_revisions_and_unit_snapshot.sql` | `session_transcript_revisions` (تاریخچه‌یِ فقط‌افزودنیِ متنِ جایگزین‌شده) + `sessions.unit_type`/`modalities` ([subsystem 08 §۴](../07-subsystems/08-session-record.md)) |
| `041_session_segments.sql` | `session_segments`، `session_speaker_roles` + `session_transcript_tokens.covers_full/source_version` ([subsystem 08](../07-subsystems/08-session-record.md)) |
| `042_session_soft_delete.sql` | `sessions.deleted_at DATETIME NULL`، `sessions.deleted_by CHAR(36) NULL` (بدونِ FK)، `idx_sessions_deleted` — **حذفِ نرمِ جلسه** (تصمیمِ مالک 2026-10-02؛ additive) |
| `043_soft_delete_everything.sql` | `clients.deleted_at/deleted_by` (+`idx_clients_deleted`)، `session_notes.deleted_at/deleted_by`، `client_members.deleted_at` — حذفِ نرمِ مراجع/یادداشت/عضو («هیچ چیزی هارد دیلیت نشود»، 2026-10-02؛ additive) |
| `044_edit_history.sql` | `session_note_revisions` (متنِ قبلیِ یادداشت)، `client_case_file_versions` (محتوایِ قبلیِ پرونده؛ `UNIQUE(client_id, content_version)`) — «همه‌چیز قابلِ بازیابی باشد» (2026-10-02؛ additive) |

جدولِ سیستمی: `_migrations(id INT AUTO_INCREMENT PK, name VARCHAR(255) UNIQUE, applied_at DATETIME)` — ساخته‌شده در `server/src/db/migrate.ts`.

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
| case_file_enabled | BOOLEAN | no | false | (022) فیچرِ پرونده برایِ این تراپیست روشن است؟ پیش‌فرض خاموش؛ محدودسازیِ فازِ اولِ deploy (تصمیمِ مالک 2026-09-23) |
| modalities | JSON | yes | NULL | (029) رویکردهایِ درمانیِ انتخابی (`tu_modalities.code[]`) |
| final_transcript_enabled | BOOLEAN | no | false | (031) «متنِ نهایی» برایِ این تراپیست (پیش‌فرض خاموش) |
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
| unit_type | VARCHAR(24) | no | `'individual'` | (029) کدِ `tu_unit_types` (`individual|couple|family|child_parent`)؛ اعضا در `client_members`؛ مراجعِ قدیمی عضوِ ضمنی از `category/gender` دارد |
| recording_consent_at | DATETIME | yes | | بعد از 024 (2026-09-24)؛ زمانِ **اولین** رضایتِ صریحِ ضبط/رونویسی (جلسه‌ی زنده یا آپلود) — «یک بار برایِ هر مراجع». NULL = پرسیده می‌شود. لغو ⇒ NULL. بدونِ backfill |

### `sessions`
| ستون | نوع | null | پیش‌فرض | نکته |
|---|---|---|---|---|
| id | UUID | no | gen_random_uuid() | PK |
| client_id | UUID | no | | FK → clients CASCADE |
| session_num | INTEGER | no | | UNIQUE(client_id, session_num)؛ `MAX+1` (غیراتمیک) |
| date | TEXT | **yes** (014) | | شمسیِ `YYYY/MM/DD` با ارقامِ لاتین (نرمال‌سازی و اعتبارسنجی در `features/sessions/sessionDate.ts`؛ داده‌ی قبلی با 013)؛ `NULL` فقط برایِ `source=manual` بدونِ تاریخِ ورودی («بدونِ تاریخ»)؛ جلسه‌ی `live` همیشه مقدار دارد (fallback به وقتِ ایران)؛ `MAX(date)` = آخرین جلسه (NULLها نادیده گرفته می‌شوند) |
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
| source | TEXT | no | `'live'` | CHECK `live|manual|upload` (012؛ `upload` از 023)؛ `manual` = ثبتِ دستیِ جلسه‌ی گذشته، بدونِ صدا/رونویسی |
| auto_closed_at | DATETIME | yes | | (026) زمانِ بستنِ خودکارِ جلسه‌ی زنده‌ی رهاشده (`features/sessions/autoClose.ts`)؛ بازگشایی (PUT `status=in_progress` یا mintِ رونویسی) آن را NULL می‌کند |
| attendees | JSON | yes | | (029) شرکت‌کنندگانِ همین جلسه (زیرمجموعه‌ی `client_members.id`)؛ NULL = همه‌ی اعضا |
| pre_note | TEXT | yes | | (029) **دیگر نوشته نمی‌شود** — یادداشتِ پیش از جلسه اکنون ردیفِ `session_notes(type='note_before'/'voice_before')` است؛ مقادیرِ موجود فقط‌خواندنی نمایش داده و واردِ پرونده می‌شوند |

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
| kind | VARCHAR(8) | **(017)** `'session'` یا `'note'`؛ **`'prenote'` (2026-09-29، بدونِ migration)** = صدایِ یادداشتِ صوتیِ پیش از جلسه — فقط برایِ نمایش/فیلترِ پنلِ ادمین؛ هرچه `kind <> 'session'` است هرگز واردِ فایلِ کامل/بازسازیِ گوینده/متن نمی‌شود. seq برایِ هر kind جدا از ۰ است؛ **از 2026-09-29 فایلِ kindِ غیرِ session پیشوندِ `<kind>-` دارد** (`note-000000.webm`) — قبلاً سگمنتِ ۰ِ یادداشت و جلسه یک نامِ فایل داشتند و رویِ هم نوشته می‌شدند؛ ردیف‌هایِ قدیمی مسیرِ خودشان را دارند |
| sha256 | CHAR(64) NULL | **(017)** hashِ بایت‌های فایل؛ `UNIQUE(session_id, sha256)` باعثِ idempotent‌بودنِ retryِ همان آپلود می‌شود (بدونِ ردیفِ تکراری) |
| path | TEXT NOT NULL | مسیرِ مطلقِ فایل روی دیسکِ سرور |
| bytes | INTEGER NOT NULL | |
| mime | TEXT | |
| source | TEXT NOT NULL | پیش‌فرض `'durable'`؛ `'offline'` رزرو؛ **`'upload'` (023)** برایِ نسخه‌ی نرمال‌شده‌ی فایلِ آپلودی |
| client_seq | INT NULL | **(027)** شماره‌ی سگمنت در همان run (از کلاینت)؛ ترتیبِ پخش/concat = (زمانِ شروعِ run از `run_id`، `client_seq`) — `sortByRecordingOrder` در `features/transcription/archive/`؛ NULL = ردیفِ قدیمی/آپلود ⇒ `seq` |
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
| `audio_jobs` | `id` PK، `upload_id` UNIQUE FK، `session_id`/`client_id`/`therapist_id` FK CASCADE، `stage` CHECK `queued\|normalizing\|transcribing\|case_file\|done\|failed`، `attempts`، `next_attempt_at`، `locked_until` (lease)، `source_path`، `source_parts` (025، JSONِ بخش‌ها به ترتیب؛ `upload_id` = بخشِ ۰)، `normalized_path`، `duration_ms`، `soniox_file_id`، `soniox_transcription_id`، `transcription_started_at`، `transcript_applied_at` (exactly-once)، `transcript_chars`، `case_file_status` (`running\|waiting\|done\|failed\|skipped\|not_applicable\|busy_gave_up`)، `error_code`، `finished_at`، `audio_quality` (033، JSON؛ از 2026-10-01 کلیدِ `speech_spans` هم دارد)، `quality_warning` (033)، `low_conf_ratio` (033)، `transcript_metrics` (036، JSON) | index `(stage, next_attempt_at)` برایِ worker |
| `notifications` | `id` PK، `therapist_id` FK، `kind` (`transcript_ready\|transcript_low_quality\|transcript_empty\|processing_failed\|case_file_updated\|case_file_failed\|final_transcript_ready\|llm_unavailable`؛ VARCHAR بدونِ CHECK؛ `llm_unavailable` از 2026-09-28 فقط برایِ ادمین‌ها با `job_id = llm-<علت>-<بازه‌ی ۶ساعته>-<۸ نویسه‌ی شناسه‌ی ادمین>`)، `client_id`/`session_id` FK CASCADE، `job_id`، `error_code`، `read_at` | `UNIQUE(job_id, kind)` ⇒ retry اعلانِ تکراری نمی‌سازد. **بدونِ متنِ بالینی** (فقط kind + شناسه). نگهداری ۳۰ روز |

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

### `audit_log` (028) — ممیزیِ کنش‌هایِ حساس
`id` BIGINT PK، `ts` DATETIME(3)، `actor_id` CHAR(36) NULL، `actor_is_admin` BOOLEAN، `action` VARCHAR(48)، `target_type` VARCHAR(24) NULL، `target_id` CHAR(36) NULL، `detail` JSON NULL (فقط از `sanitizeDetail`). ایندکس‌ها: `(ts)`، `(target_type,target_id,ts)`، `(actor_id,ts)`، `(action,ts)`. **بدونِ FK** (ردِ حسابرسی بعد از حذف می‌ماند، LAW-010). نویسنده: `server/src/obs/audit.ts` (`recordAudit`): export، تغییر/حذفِ تراپیست، حذفِ مراجع/جلسه، مشاهده‌ی متن و پخش/دانلودِ صدا توسطِ ادمین، ثبت/لغوِ رضایت، بستنِ خودکار، ادمین‌شدنِ خودکار. نگهداری: `AUDIT_LOG_RETENTION_DAYS` ([configuration-catalog](configuration-catalog.md)؛ جاروبِ `sweepOldObsEvents` در `obs/sweep.ts`). سندِ مالک: [observability-audit](../06-platform/observability-audit.md).

### `client_members` و کاتالوگِ `tu_*` (029، 030، 032) — واحدِ درمان
- `client_members(id PK, client_id FK CASCADE, role_code, alias VARCHAR(80), category VARCHAR(8), gender CHAR(1), sort, created_at)` — اعضایِ واحدِ درمان؛ ایندکس `(client_id, sort)`. `role_code` بدونِ FK به `tu_member_roles` (اعتبار در دامنه).
- `tu_member_roles(code PK, label_fa, gender, age_group, ask_age, ask_gender, context_label, sort, active)`؛ `tu_unit_types(code PK, label_fa, min_members, max_members, allowed_roles JSON, presets JSON, context_setting, sort, active)`؛ `tu_modalities(code PK, label_fa, default_unit, context_label, sort, active)`؛ `tu_modality_terms(modality_code FK CASCADE, term)` PK ترکیبی.
- کاتالوگ‌ها با `INSERT IGNORE` seed می‌شوند؛ ویرایشِ seed = migrationِ جدید (نه ویرایشِ فایلِ اعمال‌شده). سندِ مالک: [ماژول 09](../04-modules/09-treatment-unit/module-prd.md).

### `final_transcripts` (031، 034) — «متنِ نهایی»
یک ردیف به‌ازایِ هر جلسه: `session_id` PK (FK CASCADE)، `therapist_id`/`client_id` (FK CASCADE)، `stage` CHECK `waiting_audio|transcribing|polishing|done|failed|skipped`، `attempts`، `next_attempt_at`، `locked_until` (lease)، `source` CHECK `async|realtime`، `source_version` (مبنایِ stale)، `soniox_file_id`، `soniox_transcription_id`، `transcription_started_at`، `async_text`/`clean_text` LONGTEXT (**متنِ بالینی**)، `clean_turns` JSON (034؛ نوبت‌هایِ ساختاریافته `[{role,text,raw?,sp?,marker?}]` — **متنِ بالینی**؛ NULL ⇒ UI همان `clean_text`)، `polish_report` JSON (فقط شمارنده و مدل)، `error_code`، `queued_at`، `finished_at`. index `(stage, next_attempt_at)`. `sessions.transcript` هرگز دست نمی‌خورد. سندِ مالک: [subsystem 07](../07-subsystems/07-final-transcript.md).

### `final_transcript_versions` (037) — تاریخچه‌ی «متنِ نهایی»
`id` BIGINT PK، `session_id` (FK CASCADE)، `version` (UNIQUE با `session_id`، از ۱)، `kind` CHECK `baseline|generated|role_edit`، `source`/`source_version` (کپیِ ردیفِ جاری)، `clean_text` LONGTEXT NOT NULL، `clean_turns` JSON، `polish_report` JSON (فقط `baseline`/`generated`)، `created_by` (درمانگرِ اصلاحِ نقش، بدونِ FK)، `created_at`. فقط INSERT: `runner.finish` و `PATCH …/final-transcript/roles` داخلِ تراکنش با قفلِ ردیفِ `final_transcripts` (`adapters/versionStore.ts`)؛ `baseline` = متنِ پیش از 037 که فقط پیش از اولین بازنویسی‌اش کپی می‌شود (بدونِ backfill).

## ۳. Enumها (مقادیرِ واقعی در کد)

| فیلد | مقادیر | نویسنده‌ها |
|---|---|---|
| `sessions.status` | `in_progress`، `recovered`، `completed`، `canceled` | `POST /api/sessions`، `PUT` (آزاد)، `features/legacy-ws/transcription.routes.ts` |
| `sessions.batch_status` | `queued`، `processing`، `done`، `failed`، null | `features/transcription/batch/` |
| `sessions.stt_mode` | `realtime`، `batch`، `batch-pending`، `realtime-unreliable-noaudio`، null | `feelia-rt.js`، `features/transcription/batch/` |
| `session_notes.type` | `note_during`، `note_after`، `sign`، `voice`، **`note_before`، `voice_before` (2026-09-29 — یادداشتِ متنی/صوتیِ پیش از جلسه؛ نوع‌هایِ ویرایش‌پذیر با `PATCH /api/notes/:id` (+ `note_during` از 2026-10-03)؛ VARCHAR(16) کافی است، بدونِ migration)** | UI، batch/voice-note، `createLiveSession`، `processQueue` (`purpose=pre-note`) |
| `session_notes.sign_type` | `گریان`، `لرزش`، `تنش عضلانی`، `سکوت طولانی`، `خشم`، `پرخاشگری`، `اتصال چشمی گریزان`، `خواب‌آلودگی`، `بی‌قراری` | `.sign-chip[data-sign]` |
| `clients.status_reason` (UI) | `ناتوانی مالی`، `ظرفیت روحی/زمانی`، `روند تکمیل شد`، `سایر` + متنِ آزاد؛ «نامشخص» → null (فقط در ساختِ مراجع از تبِ غیرفعال)؛ سرور trim و حداکثر ۲۰۰ کاراکتر | `deactivateClientModal`، `newClientModal` |
| `sessions.source` | `live`، `manual`، `upload` (CHECK؛ `upload` از 023) | `POST /api/sessions` (`mode`)؛ `POST /api/uploads/:id/complete` |
| `sessions.stt_mode` (افزوده) | `upload` (023) | `worker.ts` (+ `jobStore.sql.ts`) |
| `session_audio.source` | `durable`، `upload` (023) (و `offline` در type) | `features/transcription/archive/` |
| `clients.unit_type` | `individual`، `couple`، `family`، `child_parent` (کاتالوگِ `tu_unit_types`) | `features/treatment-unit/` |
| `final_transcripts.stage` | `waiting_audio`، `transcribing`، `polishing`، `done`، `failed`، `skipped` | `features/final-transcript/` |
| `audio_uploads.status` | `uploading`، `complete`، `failed`، `canceled` | `features/audio-upload/` |
| `audio_jobs.stage` | `queued`، `normalizing`، `transcribing`، `case_file`، `done`، `failed` | `features/audio-upload/` |
| `client_case_file.status` | `ready`، `generating`، `error`، `stale` | `features/case-file/adapters/repository/caseFileRepository.sql.ts` |

## ۴. کوئری‌های حساس به عملکرد
- `GET /api/clients` و `/api/admin/therapists`: `LEFT JOIN` + `GROUP BY` روی همه‌ی جلسات.
- `/api/admin/export`: حلقه‌ی N+1 روی تراپیست‌ها، همه در حافظه.
- `query()` کوئری‌های >100ms را لاگ می‌کند (۶۰ کاراکترِ اولِ SQL، بدونِ پارامتر).
