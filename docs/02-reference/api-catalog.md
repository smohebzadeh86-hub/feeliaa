# API Catalog

> **وضعیت:** ACTIVE-CANONICAL (مالکِ endpoint و payload) · منبع: `server/src/app.ts` (ثبتِ pluginها) + `server/src/features/*/*.routes.ts` + `server/src/obs/obs.routes.ts` · قراردادِ method/path/guard در `scripts/route-snapshot.txt` (`pnpm test:routes`) · last-verified: 2026-09-30 @ `17d6919`.
> Auth: `public` = بدونِ guard · `auth` = `requireAuth` (401) · `admin` = `requireAdmin` (401/403).
> مالکیت: `owned` = اگر منبع مالِ تراپیست نباشد 404.
> خطاها: شکلِ کلی `{ "error": "<فارسی>", "code"?: "<machine>" }` — [error-code-catalog](error-code-catalog.md).
> مصرف‌کننده: `UI` = `index.html` · `RT` = `feelia-rt.js` · `AN` = `feelia-analytics.js` · `—` = هیچ مصرف‌کننده‌ای در فرانت پیدا نشد.

## ۱. عمومی

| Method | Path | Auth | پاسخ | مصرف |
|---|---|---|---|---|
| GET | `/api/health` | public | `{status:"ok"|"degraded", name, version, database:"connected"|"disconnected", timestamp}` | — (ops) |
| GET | `/*` | public | فایل‌های `public/` (`@fastify/static`) | مرورگر |

## ۲. Auth — `server/src/features/auth/auth.routes.ts`

| Method | Path | Auth | Body | موفق | خطاها | مصرف |
|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | public | `{phone, password, name, specialty, email?}` — **نام/تخصص الزامی** (تصمیمِ مالک D3، 2026-09-15؛ فقط ثبت‌نامِ جدید، بدونِ `NOT NULL` در DB) | 201 `{therapist}` + Set-Cookie | 400 (موبایل خالی/نامعتبر، ایمیلِ نامعتبر، رمز <8، نام/تخصصِ خالی یا >۱۰۰ کاراکتر)، 409 شماره‌ی تکراری | UI |
| POST | `/api/auth/login` | public | `{phone, password}` | 200 `{therapist}` + Set-Cookie | 400، 401 (عمومی)، 403 غیرفعال | UI |
| POST | `/api/auth/logout` | public | — | `{ok:true}`؛ حذفِ نشست و کوکی | — | UI |
| GET | `/api/auth/me` | (بررسیِ دستی) | — | `{therapist}` | 401 | UI (`init`) |
| PATCH | `/api/auth/case-file-auto-generate` | (بررسیِ دستی) | `{enabled: boolean}` | 200 `{case_file_auto_generate: boolean}` | 401، 400 (`enabled` غیرِboolean) | UI (toggle/مودالِ یک‌باره‌ی پرونده) |

`therapist` = `{id, phone, email, name, specialty, is_admin, created_at, case_file_auto_generate}` — سه‌حالته (`null`/`true`/`false`، migration 020). کوکی: `feelia_session`، `path=/`، `httpOnly`، `sameSite=lax`، `maxAge=2592000`.

## ۳. Clients — `server/src/features/clients/clients.routes.ts` (همه `auth`)

| Method | Path | Body/Query | موفق | خطاها | مصرف |
|---|---|---|---|---|---|
| GET | `/api/clients` | — | `{clients:[{id, code, alias, created_at, status, status_reason, category, gender, pinned_at, recording_consent_at, session_count, last_session_date}]}` مرتب با `created_at DESC` (`recording_consent_at`: زمانِ رضایتِ یک‌باره، migration 024) | — | UI |
| GET | `/api/recovered` | — | `{recovered:[{id, client_id, session_num, date, start_time, duration_ms, status, transcript, transcript_chars, client_code, client_alias}]}` جلساتِ `status='recovered'` | — | UI (`enterApp`) |
| POST | `/api/clients` | `{alias?, category?, gender?, status?: "active"|"inactive", reason?}` | 201 `{client}` (کد `CL-XXXX`)؛ `status` پیش‌فرض `active`؛ `status_reason` فقط برای `inactive` (trim، خالی → null) — UI وضعیتِ تبِ جاری را می‌فرستد (2026-09-14) | 400 دسته/جنسیت/وضعیتِ نامعتبر یا دلیل > ۲۰۰ کاراکتر | UI |
| GET | `/api/clients/:id` | — | `{client, sessions:[{id, session_num, date, start_time, duration_ms, status, source, created_at}]}` | 404 owned | UI |
| PUT | `/api/clients/:id` | `{alias}` | `{client}` | 404 owned | UI `openEditAliasModal`/`confirmEditAlias` (اصلاحِ یادداشتِ قدیمی، 2026-09-16 — از قبل در UI صدا زده می‌شد) |
| PATCH | `/api/clients/:id/status` | `{status:"active"|"inactive", reason?}` | `{client}`؛ `reason` trim و خالی → null؛ فعال‌سازی دلیل را null می‌کند؛ غیرفعال‌شدن `pinned_at` را هم null می‌کند (2026-09-16) | 400 (وضعیتِ نامعتبر، دلیل > ۲۰۰)، 404 (غیرمالک، یا حذف‌شده بینِ چک و UPDATE) | UI |
| PATCH | `/api/clients/:id/category` | `{category: "child"|"teen"|"adult"|null, gender?: "f"|"m"|null}` | `{client}` | 400، 404 | UI |
| PATCH | `/api/clients/:id/pin` | `{pinned: boolean}` | `{client}`؛ صفحه‌ی اول (نمای «امروز») مراجعِ سنجاق‌شده را نشان می‌دهد | 400 (`pinned` غیرِ boolean)، 404 | UI (2026-09-16، سنجاق به صفحه‌ی اول) |
| DELETE | `/api/clients/:id` | — | `{deleted: code, cascade:{session_count, note_count}}` | 404 | UI |
| DELETE | `/api/clients/:id/recording-consent` | — | `{recording_consent_at:null}` — لغوِ رضایتِ یک‌باره (2026-09-24). جلسه‌هایِ قبلی دست‌نخورده؛ رویدادِ `client.consent_revoked` | 404 (غیرمالک) | بدونِ caller (دکمه‌ی UI در 2026-09-25 به دستورِ مالک حذف شد) |

## ۴. Sessions و Notes — `server/src/features/sessions/` (همه `auth`)

| Method | Path | Body/Query | موفق | خطاها | مصرف |
|---|---|---|---|---|---|
| POST | `/api/sessions` | زنده: `{client_id, consent?:true, date?, start_time?, mode?:"live"}` — از 2026-09-24 `consent` فقط وقتی لازم است که مراجع رضایتِ ثبت‌شده (`recording_consent_at`) نداشته باشد؛ `consent:true` اولین بار ثبتش می‌کند (پاسخ: `client.recording_consent_at`) · ثبتِ دستیِ جلسه‌ی گذشته: `{client_id, mode:"manual", date?, start_time?, note?}` (همه اختیاری — UI فقط `client_id` می‌فرستد؛ تاریخ/ساعت با «ویرایش تاریخ/ساعت» و یادداشت با `POST /notes` بعداً تکمیل می‌شوند) | 201 `{session, client:{code, alias}}`؛ `session_num` خودکار؛ `date` (وقتی مقدار دارد) همیشه شمسیِ `YYYY/MM/DD` و `start_time` `HH:MM` با ارقامِ لاتین (ورودیِ ارقامِ فارسی/`-`/میلادی نرمال می‌شود؛ UI تاریخ/ساعتِ دستگاه را می‌فرستد)؛ **فالبکِ نامتقارن (014):** بدونِ `start_time` → همیشه وقتِ فعلیِ ایران، برایِ هر دو mode؛ بدونِ `date` → `live` وقتِ فعلیِ ایران می‌گیرد، ولی `manual` مقدارِ `NULL` («بدونِ تاریخ») می‌ماند؛ زنده: `status=in_progress`، `source=live`؛ manual: `status=completed`، `source=manual`، `consent=false` (بدونِ ضبطِ جلسه)، `note` در یک statementِ اتمیک به‌صورتِ `session_notes(type='note_after')` — یادداشتِ صوتی/متنیِ بیشتر بعداً از `POST /api/sessions/:id/notes` (REQ-033) | 400 (mode نامعتبر، زنده بدونِ consent و بدونِ رضایتِ ثبت‌شده ⇒ `consent-required`، تاریخ/ساعتِ نامعتبر وقتی فرستاده شده)، 404 مراجعِ غیرمالک، **409 `client-inactive`** (جلسه‌ی زنده برای مراجعِ غیرفعال) | UI |
| GET | `/api/sessions/:id` | — | `{session: s.* + code, alias, notes:[…]}` → دقیقاً `{session, notes}` | 404 | UI، RT |
| PUT | `/api/sessions/:id` | هر ترکیب از `{transcript, transcript_version, change_reason, realtime_reliable, stt_mode, anchors, duration_ms, status, date, start_time}` — **2026-10-01:** `transcript` بدونِ `transcript_version` ⇒ **400 `version-required`** (CAS اجباری؛ `TRANSCRIPT_CAS_REQUIRED=0` بازگشتِ اضطراری)؛ `change_reason` ∈ `resolve-speakers|marker-remove|edit` علتِ تاریخچه‌یِ متن؛ هر جایگزینیِ غیر-الحاقی متنِ قبلی را در `session_transcript_revisions` (040) نگه می‌دارد | `{session}`؛ نوشتنِ `transcript` نسخه را +1 می‌کند؛ `date`/`start_time` مثلِ POST نرمال می‌شوند (شمسیِ `YYYY/MM/DD`، `HH:MM`)؛ **(014)** `date` را می‌توان با رشته‌ی خالی/`null` پاک کرد («بدونِ تاریخ»)، ولی **فقط برایِ جلسه‌ی `source=manual`** — روی جلسه‌ی `live`/`completed` پاک‌کردنِ تاریخ 400 می‌دهد | 400 بدنه‌ی خالی، `invalid-status`،تاریخ/ساعتِ نامعتبر، یا پاک‌کردنِ `date` روی جلسه‌ی غیرِ manual، 404، **409 `invalid-transition`** (از `completed`/`canceled` به وضعیتِ دیگر، جز جلسه‌ی خودکاربسته)، **409 `version-conflict`** اگر `transcript_version` ارسالی ≠ DB (`current_version` در پاسخ) | UI، RT |
| DELETE | `/api/sessions/:id` | — | `{deleted: id, recoverable: true}` — **حذفِ نرم (2026-10-02، تصمیمِ مالک، migration 042):** `deleted_at/deleted_by` ست می‌شود؛ متن، صدا، یادداشت‌ها و علائم برایِ ادمین می‌مانند و هیچ فایلی پاک نمی‌شود. جلسه برایِ تراپیست 404 است (همه‌ی `getOwnedSession`) | 404 | UI (حذفِ جلسه؛ «لغو جلسه» از 2026-10-02 به‌جایِ آن `PUT status=canceled` می‌زند) |
| DELETE | `/api/clients/:id` | — | `{deleted: code, cascade:{session_count,note_count}, recoverable:true}` — **حذفِ نرم (2026-10-02، migration 043):** `clients.deleted_at/deleted_by`؛ جلسه‌ها، متن، یادداشت و صدا می‌مانند؛ مراجع برایِ تراپیست 404 است و در فهرست نمی‌آید | 404 | UI (حذفِ مراجع) |
| GET | `/api/deleted-clients` | — | `{clients:[{id, code, alias, deleted_at, session_count}]}` (حداکثر ۲۰۰) — مسیرِ پیدا کردنِ مراجعِ حذف‌شده | — | UI «مراجعینِ حذف‌شده» |
| POST | `/api/clients/:id/restore` | — | `{restored: code}` — audit `therapist.client_restore` | 404، 409 `not-deleted` | UI |
| DELETE | `/api/notes/:id` | — | `{deleted: id, recoverable:true}` — **حذفِ نرم (043):** `session_notes.deleted_at/deleted_by`؛ برایِ تراپیست/پرونده/متنِ نهایی نامرئی، برایِ ادمین با `deleted_at` | 404 | UI |
| GET | `/api/notes/:id/revisions` | — | `{revisions:[{id, chars, created_at}]}` — نسخه‌هایِ قبلیِ متنِ یادداشت (migration 044؛ فقط متادیتا) | 404 | UI/بازیابی |
| POST | `/api/notes/:id/revisions/:rid/restore` | — | `{note}` — بازگردانیِ یک نسخه؛ متنِ فعلی هم در تاریخچه می‌ماند (برگشت‌پذیر) | 404 | بازیابی |
| POST | `/api/sessions/:id/restore` | — | `{restored: id}` — بازگردانیِ جلسه‌یِ حذف‌شده‌یِ خودِ تراپیست؛ audit `therapist.session_restore` | 404 (ناموجود/غیرمالک)، 409 `not-deleted` | UI «جلسه‌هایِ حذف‌شده» |
| GET | `/api/clients/:id/deleted-sessions` | — | `{sessions:[{id, session_num, date, start_time, status, source, deleted_at, transcript_len}]}` (حداکثر ۱۰۰، فقط متادیتا) — مسیرِ پیدا کردنِ جلسه‌یِ حذف‌شده | 404 owned | UI |

`status` در PUT فقط `in_progress|recovered|completed|canceled` (A3/A5، 2026-09-26)؛ `completed→in_progress` فقط برایِ جلسه‌ی خودکاربسته (`auto_closed_at` ⇒ NULL، رویدادِ `session.reopened`).

| POST | `/api/sessions/:id/transcript-tail` | `{base_version:number, tail:string (≤60000)}` | `{ok:true, transcript_version}` — `tail` به انتهایِ متنِ همان نسخه اضافه و نسخه +1 (A5، 2026-09-26) | 400 `bad-tail`، 404، 409 `version-conflict` | RT (`flushTranscriptNow` در pagehide وقتی کلِ متن > ۶۰KB) |
| GET | `/api/sessions/:id/transcript-revisions` | — | `{revisions:[{id, version, cause, actor_is_user, chars, created_at}]}` — جدیدترین اول (حداکثر ۲۰۰)، **فقط متادیتا** | 404 (owned) | UI «تاریخچه‌ی ویرایش» (F8، 2026-10-02؛ جدولِ `session_transcript_revisions` تا آن‌جا فقط‌نوشتنی بود) |
| GET | `/api/sessions/:id/transcript-revisions/:rid` | — | `{revision:{id, version, cause, chars, created_at}, text, current_version, diff:{ops:[{op:'same'|'removed'|'added', text}], summary:{same,removed,added}} | null}` — diff در سطحِ پاراگراف از «این نسخه» به «متنِ فعلی»؛ `null` اگر >۳۰۰۰ پاراگراف | 404 (جلسه یا نسخه) | UI |
| POST | `/api/sessions/:id/transcript-revisions/:rid/restore` | `{transcript_version:number}` (CAS الزامی) | `{ok:true, transcript_version}` — متنِ فعلی پیش از جایگزینی با `cause='restore'` در همان تاریخچه می‌ماند (بازگردانی برگشت‌پذیر است). رویداد `session.transcript_restore` | 400 `version-required`، 404، 409 `version-conflict` (+`current_version`) / `same-text` | UI |
| POST | `/api/sessions/:id/notes` | `{type: note_during|note_after|note_before|sign|voice, text?, sign_type?, offset_ms?, wall_clock?}` — `note_before` (2026-09-29): یادداشتِ متنیِ پیش از جلسه‌ای که UI بعد از ساختِ جلسه‌ی **آپلودی** می‌فرستد | 201 `{note}` | 400 بدونِ type، 404 | UI |
| PATCH | `/api/notes/:id` | (2026-09-29) `{text}` — فقط یادداشتِ پیش از جلسه (`note_before`/`voice_before`) | 200 `{note}` | 404 غیرمالک/ناموجود؛ 400 `note-not-editable` (نوعِ دیگر)، `note-empty`، `note-too-long` (> ۲۰۰۰۰ نویسه) | UI (Wrapup، صفحه‌ی جلسه) |
| DELETE | `/api/notes/:id` | — | `{deleted: id}` | 404 (مالکیت با join) | UI |
| POST | `/api/sessions/:id/voice-note` | multipart `file` (100B–50MB) | 202 `{status:"processing"}`؛ رونویسیِ async در پس‌زمینه → `session_notes(type=voice)` | 400، 404، 500 بدونِ کلید | **—** (LEGACY، LAW-015) |
| POST | `/api/sessions/:id/batch-audio` | query `purpose=transcript|note|archive|late-transcript|note-archive|pre-note` (پیش‌فرض transcript؛ **`pre-note` (2026-09-29): یادداشتِ صوتیِ پیش از جلسه — آرشیو با kind=prenote + رونویسی (بدونِ تفکیکِ گوینده) ⇒ `session_notes(type='voice_before')`، هرگز transcript؛ رویِ completed مجاز، رویِ canceled 400**؛ **`note-archive` (2026-09-26): صدایِ یادداشتِ صوتیِ موفق، فقط آرشیو با kind=note، بدونِ رونویسی**، **`late-transcript`: صدایِ دوره‌ی قطعیِ اینترنت (audit صدا، 2026-09-16)**)، `seq`، **`run` (017 — شناسه‌ی RTSessionِ کلاینت؛ نبودش = `'legacy'`)**، **`empty` (2026-10-01، 039 — فهرستِ client_seqِ سگمنت‌هایِ *خالی* پیش از این سگمنت، «3,7»؛ در `session_audio_skips` ثبت می‌شود؛ نامعتبر نادیده، سقف ۱۰۰)**؛ multipart `file` | 202 `{status:"queued", purpose, base_version}` | 400 (`transcript` روی completed/canceled؛ `late-transcript` فقط روی canceled؛ فایل نیست؛ حجم)، 404 | RT، UI (`sweepOrphanedAudioQueue`) |
| GET | `/api/sessions/:id/audio-status` | — | `{source, audio_status: none|syncing|incomplete|complete, archived_ms, expected_ms, missing_count, pending_count, transcript_status, expired}` (**جدید 2026-10-01**؛ «دفترِ کامل‌بودنِ صدا» برایِ تراپیست؛ فقط عدد؛ `missing_count` از چکِ `client_seq` + `session_audio_skips`؛ `expired` = صدا طبقِ ۳۰روزه پاک شده) | 404 | UI (`renderSessionAudioStatus`) |
| GET | `/api/sessions/:id/speakers` | — | `{has_record, source?, covers_full?, roles_complete?, speakers:[{speaker_key, ordinal, turns, share, role, label}]}` (**جدید 2026-10-01**، رکوردِ canonical، [subsystem 08](../07-subsystems/08-session-record.md)) | 404 | UI (`renderSpeakerRoles`) |
| PUT | `/api/sessions/:id/speakers` | `{roles:{"<speaker_key>":{role: therapist|client|member|other, label?}}}` | `{updated}` | 400 (`invalid-roles`)، 404، 409 `no-record` | UI |
| GET | `/api/sessions/:id/batch-status` | — | `{batch_status, stt_mode, realtime_reliable, transcript_version, audio_pending, note_audio_pending, late_transcript_pending, pre_note_audio_pending}` (`pre_note_audio_pending` از 2026-09-29 — Wrapup برایِ «در حالِ آماده‌سازیِ متن…») | 404 | RT، UI |
| POST | `/api/sessions/:id/batch-retry` | query `purpose=transcript|note|late-transcript` (پیش‌فرض transcript) | `{status:"retrying", purpose}` | 400 (صوتی در صف نیست)، 404 | — (فقط harness) |
| POST | `/api/sessions/:id/resolve-speakers` | — | 202 `{status}` (idempotent) | 400 (جلسه completed نیست؛ صدای آرشیو نیست)، 404 | UI |
| GET | `/api/sessions/:id/resolve-speakers` | — | `{status: processing|done|error, text?, error?}` | 404 (جلسه یا job) | UI |

## ۵. STT — `server/src/features/transcription/stt.routes.ts` (همه `auth`)

| Method | Path | Body | موفق | خطاها | مصرف |
|---|---|---|---|---|---|
| GET | `/api/stt/check` | — | همیشه 200: `{ok:true, code:"mint-ok", websocket_url}` یا `{ok:false, code, error}` (فیلدِ `proxy` و probeِ legacy از 2026-09-24 حذف شد) | — | UI (preflight، غیرمسدودکننده) |
| POST | `/api/stt/realtime-session` | `{session_id, purpose?: "transcript"\|"note"\|"pre-note"}` — `pre-note` (2026-09-30): متنِ زنده‌ی یادداشتِ صوتیِ پیش از جلسه؛ جلسه هنوز نیست ⇒ `session_id` **نادیده گرفته می‌شود** و لازم نیست؛ فقط نمایشِ زنده (متنِ ذخیره‌شده از صدایِ آپلودشده می‌آید)؛ `stt_defaults.context` برایِ غیرِ transcript خالی است | `{websocket_url, model:"stt-rt-v5", api_key:<temp>, expires_in_seconds:120, single_use:true, credential_scope:"transcribe_websocket", expires_at, stt_defaults}` | 400، 401، 404 owned، 400 جلسه پایان‌یافته (جلسه‌ی خودکاربسته با `purpose=transcript` به‌جایش دوباره باز می‌شود — A3، 2026-09-26)، 429 (>30/min)، 500 `no-key`، 502 `mint-rejected`، 503 `mint-transport|mint-timeout` | RT، UI (`SonioxDirect`) |

## ۶. Client config — `server/src/features/client-config/clientConfig.routes.ts`

| Method | Path | Auth | پاسخ | نکته |
|---|---|---|---|---|
| GET | `/api/client-config` | auth | `{clarity: {projectId} \| null, obs: {enabled, sample}}`، هدر `Cache-Control: no-store` | Clarity برای ادمین همیشه null؛ ID نامعتبر → null. `obs` **(جدید، فازِ ۱ِ رصد/حسابرسی، 2026-09-22)** برخلافِ Clarity برایِ ادمین هم پر می‌شود — از `OBS_CLIENT_ENABLED`/`OBS_CLIENT_SAMPLE` |

## ۶.۱ Observability — `server/src/obs/obs.routes.ts` (`auth`) — جدید، فازِ ۱ (2026-09-22)

| Method | Path | Body | موفق | خطاها | مصرف |
|---|---|---|---|---|---|
| POST | `/api/obs/events` | `{events:[...]}` — ۱ تا ۲۰۰ رویداد؛ `bodyLimit:64KiB`. دو شکلِ آیتم: **(۱) UI** `{nav_id, seq, kind:'click'\|'nav'\|'visibility'\|'net'\|'lifecycle'\|'error', screen?, session_id?, target_id?, target_role?, target_tag?, value_num?, ts?}` → `obs_ui_events`. **(۲) client_event (فازِ ۲، از 2026-09-23)** `{nav_id, seq?, kind:'client_event', event, session_id?, run_id?, detail?, ts?}` — `event` باید عضوِ `OBS_CLIENT_EVENTS` باشد (`rt.ws_open`/`rt.ws_close`/... — رجوع به `server/src/obs/types.ts`)، `detail` از `sanitizeDetail()` رد می‌شود → `obs_events` (نه `obs_ui_events`؛ `run_id` اینجا join به `session_audio.run_id` دارد) | 204 (پیش از هر کارِ DB)؛ رویدادهایِ نامعتبر/نام‌ناشناس بی‌صدا drop می‌شوند، نه 400 | 400 `obs-bad-payload` (بدنه/آرایه‌ی نامعتبر)، 429 `obs-rate-limited` (>۲۰ درخواست یا >۱۵۰۰ رویداد/دقیقه به‌ازایِ تراپیست) | `public/feelia-obs.js`، `public/feelia-rt.js` (فقط `client_event`) |

`ts` (اگر فرستاده شود) فقط به‌عنوانِ `client_ts` پذیرفته می‌شود و فقط اگر در بازه‌ی ±۲۴ ساعتِ زمانِ
سرور باشد؛ زمانِ اصلیِ ردیف (`ts`) همیشه `DEFAULT`ِ ستونِ DB است، هرگز از بدنه‌ی درخواست. اگر
`session_id` مالِ تراپیستِ درخواست‌دهنده نباشد، ردیف با `session_id=null` ذخیره می‌شود + یک
رویدادِ جداگانه‌ی `obs.session_mismatch` — تله‌متری هرگز 404 نمی‌دهد (نباید existence oracle شود).

## ۷. Admin — `server/src/features/admin/` (همه `admin`)

| Method | Path | Body/Query | موفق | خطاها |
|---|---|---|---|---|
| GET | `/api/admin/stats` | — | `{stats:{therapists, clients, sessions, sessions_today, sessions_this_week}}` (اعداد ممکن است به‌صورتِ رشته برگردند — از درایورِ DB) | — |
| GET | `/api/admin/therapists` | `?q=` (phone/name/email، LIKE) | `{therapists:[{id, phone, email, name, specialty, is_admin, active, created_at, client_count, session_count, last_session_at}]}` | — |
| GET | `/api/admin/therapists/:id/clients` | — | `{therapist:{id, phone, name, specialty}, clients:[{id, code, alias, status, status_reason, category, gender, created_at, session_count, last_session_date}]}` (بدونِ transcript) | 404 |
| GET | `/api/admin/clients/:id/sessions` | — | `{client:{id, code, alias}, sessions:[{id, session_num, date, start_time, duration_ms, status, source, consent, audio_count, created_at, last_recording_at, …}]}` — ترتیب (2026-10-01): `COALESCE(last_recording_at, created_at) DESC` (`last_recording_at` = آخرین سگمنتِ `session_audio` با `kind='session'`) | 404 |
| GET | `/api/admin/sessions/:id` | — | **(جدید، D2، 2026-09-15)** `{session:{id, client_id, session_num, date, start_time, duration_ms, status, source, consent, transcript, created_at}, notes:[{id, type, text, sign_type, offset_ms, wall_clock, created_at}]}` — متنِ کاملِ رونویسی + همه‌ی یادداشت‌ها/علائم، فقط‌خواندنی | 404 |
| GET | `/api/admin/sessions/:id/audio` | — | `{audio:[{id, seq, bytes, mime, source, kind, duration_ms, created_at}]}` (`kind` از 017) + `pending_count` — تعدادِ فایلِ هنوز-در-صفِ سرور (هر purpose) | 404 |
| GET | `/api/admin/sessions/:id/audio/full` | query `?download=1` اختیاری برایِ `Content-Disposition: attachment`؛ هدرِ `Range` پشتیبانی می‌شود | 200/206 streamِ فایلِ کاملِ چسبیده‌شده‌ی همه‌ی سگمنت‌هایِ `kind='session'` (ffmpeg concat، کش‌شده در `data/session-audio/<sid>/full.<ext>`) | 404 (جلسه یا صدا نیست)، 503 (`ffmpeg رویِ سرور نیست`، پیامِ روشن) |
| GET | `/api/admin/session-audio/:audioId/stream` | هدر `Range` اختیاری؛ query `?download=1` اختیاری **(جدید، 2026-09-16)** برایِ افزودنِ `Content-Disposition: attachment` | 200 یا 206 stream (`audio/webm` پیش‌فرض) | 404 (ردیف یا فایل) |
| GET | `/api/admin/therapists/:id/export` | — | JSON دانلودی `feelia-<phone>.json`: `{therapist(+specialty), clients(+status/status_reason/category/gender):[…sessions(+source/consent):[…transcript, notes]]}` (فیلدهای اضافه: D2، 2026-09-15) | 404 |
| GET | `/api/admin/export` | — | `feelia-export-YYYY-MM-DD.json`: `{exported_at, therapists:[…]}` | — |
| PATCH | `/api/admin/therapists/:id` | `{active?, is_admin?}` | `{therapist}` | 400 (غیرفعال‌کردنِ خود؛ برداشتنِ ادمینِ خود وقتی تنها ادمین است؛ بدنه‌ی خالی)، 404 |
| DELETE | `/api/admin/therapists/:id` | — | `{deleted: phone}` (cascade) | 400 حذفِ خود، 404 |
| DELETE | `/api/admin/clients/:id` | — | `{deleted: code}` | 404 |

نکته: پارامترهای `:id` اعتبارسنجیِ UUID ندارند؛ مقدارِ غیر-UUID معمولاً فقط «یافت نشد» (404) می‌دهد چون ستون‌ها `CHAR(36)` هستند (**INFERRED**؛ بررسی نشده).

### ۷.۱ Observability — پنلِ ادمین (`server/src/features/admin/`، همه `admin`) — جدید، فازِ ۱ (2026-09-22)

| Method | Path | Query | موفق | نکته |
|---|---|---|---|---|
| GET | `/api/admin/sessions/recent` | `status=in_progress\|completed\|canceled\|all` (پیش‌فرض `in_progress`؛ `canceled` از 2026-10-02)، `since_hours` (پیش‌فرض ۱۶۸)، `therapist_id?`، `has_transcript=true\|false`، `limit` (≤۲۰۰)، `offset` | `{sessions:[{id, session_num, date, start_time, status, source, created_at, updated_at, client_id, client_code, therapist_id, therapist_name, transcript_len, audio_count, audio_bytes, audio_duration_ms, note_count, last_recording_at, last_activity_at}]}` — ترتیب پیش‌فرض (2026-10-03): `last_activity_at DESC` = `GREATEST(created_at, آخرین ضبطِ kind='session')`؛ پنجره‌ی `since_hours` هم رویِ `max(updated_at, آخرین ضبط)` (آخرین ضبطِ صدایِ جلسه، وگرنه زمانِ ساختِ جلسه) | حلِ مشکلِ کشف‌پذیریِ اصلیِ پلن: فهرستِ سراسریِ جلساتِ اخیر/ناتمام. `transcript_len` از `CHAR_LENGTH` (نه `LENGTH`ِ بایت‌محور — فارسیِ utf8mb4 چندبایتی است)؛ خودِ متن هرگز SELECT نمی‌شود |
| POST | `/api/admin/sessions/:id/restore` | — | `{restored: id}` — بازگردانیِ جلسه‌یِ حذفِ‌نرم‌شده به فهرستِ تراپیست؛ audit `admin.session_restore` | 404 | UI ادمین (دکمه‌یِ «بازگردانی به فهرستِ تراپیست») |
| DELETE | `/api/admin/clients/:id` | — | `{deleted: code, recoverable:true}` — حذفِ نرم (043)؛ audit `admin.client_delete` (`soft:true`) | 404، 409 `already-deleted` | UI ادمین |
| POST | `/api/admin/clients/:id/restore` | — | `{restored: id}` — audit `admin.client_restore` | 404 | UI ادمین |
| GET | `/api/admin/deleted` | — | `{clients:[…], sessions:[…], notes:[…]}` — همه‌یِ حذف‌شده‌هایِ نرمِ کلِ سیستم (حداکثر ۲۰۰ تا از هر نوع؛ فقط متادیتا) | 401/403 | UI ادمین «داده‌هایِ حذف‌شده» (2026-10-02) |
| POST | `/api/admin/notes/:id/restore` | — | `{restored: id}` | 404 | UI ادمین |
| GET | `/api/admin/sessions/:id/transcript-revisions` | — | `{revisions:[{id, version, cause, by_user, chars, created_at}]}` (حتی جلسه‌یِ حذف‌شده) | — | UI ادمین |
| GET | `/api/admin/sessions/:id/transcript-revisions/:rid` | — | `{id, version, cause, chars, created_at, text}`؛ audit `admin.session_view` | 404 | UI ادمین |
| GET | `/api/admin/notes/:id/revisions` | — | `{revisions:[{id, chars, created_at}]}` | — | ادمین |
| GET | `/api/admin/notes/:id/revisions/:rid` | — | `{id, text, created_at}`؛ audit | 404 | ادمین |
| GET | `/api/admin/clients/:id/case-file` | — | `{case_file:{client_id, content, status, model, content_version,…}, versions:[{id, content_version, …}]}`؛ audit | 404 | ادمین |
| GET | `/api/admin/clients/:id/case-file/versions/:vid` | — | `{id, content_version, content,…}`؛ audit | 404 | ادمین |
| DELETE | `/api/admin/therapists/:id` | — | **غیرفعال (2026-10-02):** 409 `hard-delete-disabled` (به‌جایش `PATCH .../therapists/:id` با `active:false`)؛ audit `admin.hard_delete_blocked` | 400 (خودتان)، 404، 409 | UI (دکمه‌یِ «حذف» برداشته شد) |
| DELETE | `/api/admin/sessions/:id/audio` | — | **غیرفعال (2026-10-02):** 409 `hard-delete-disabled`؛ صدا هرگز پاک نمی‌شود؛ audit `admin.hard_delete_blocked` | 404، 409 | UI (دکمه‌یِ «حذفِ صدا» برداشته شد) |
| GET | `/api/admin/sessions/:id/diagnosis` | — | `{diagnosis:{status, duration_ms, audio_ms, audio_segments, audio_kbps, missing_segments, pending_count, ws_drops, reconnect_ok, reconnect_exhausted, mint_failed, mic_lost, quality_warnings, hidden_count, hidden_ms, end_clicked_at, completed_at, transcript_chars, speaker_paragraphs, short_paragraphs, updated_at, created_at, upload_jobs:[{stage, duration_ms, error_code, upload_started_at, upload_completed_at, transcript_applied_at, finished_at}], final_transcript:{stage, error_code, finished_at}\|null}, findings:[{level:"ok"\|"warn"\|"error", text}]}` | «چه اتفاقی افتاد؟» برایِ ادمین (2026-09-26): محاسبه از `sessions` + `session_audio` + `obs_events` + `obs_ui_events` + صفِ batch؛ متنِ بالینی برنمی‌گردد (فقط شمارش/طول). سکوت = `audio_kbps<6` رویِ >۲۰ث صدا. (2026-09-29) جلسه‌ی `upload`: یافته‌ها از `audio_jobs`+`audio_uploads` (زمانِ آپلود، مدتِ فایل، زمانِ ذخیره‌ی رونویسی/خطا/در حالِ پردازش، هشدارِ کیفیت)؛ هر جلسه‌ای با ردیفِ `final_transcripts`: وضعیتِ متنِ نهایی | 404 جلسه نیست |
| GET | `/api/admin/sessions/:id/final-transcript/versions` | — | `{versions:[{version, kind:"baseline"|"generated"|"role_edit", source, source_version, created_at, by_user, chars, turns}]}` | (2026-10-01) تاریخچه‌ی فقط‌افزودنیِ «متنِ نهایی» (migration 037)، جدیدترین اول؛ فقط متادیتا | 404 شناسه‌ی نامعتبر |
| GET | `/api/admin/sessions/:id/final-transcript/versions/:v` | — | `{version, kind, clean_text, created_at}` | (2026-10-01) متنِ یک نسخه؛ ممیزی با `admin.session_view` (`detail.final_transcript_version`) | 404 نسخه نیست |
| GET | `/api/admin/audio-archive` | query: `therapist_id`, `client_id`, `from`, `to` (YYYY-MM-DD)، `limit` (≤100)، `offset` | `{items:[{session_id, session_num, date, status, source, client_id, client_code, therapist_id, therapist_name, segments, bytes, audio_ms, audio_kbps, silent, complete, missing_segments, pending_count, first_at, last_at, days_left}], has_more, totals:{sessions, bytes, audio_ms, expiring_2d}, retention_days}` (از 2026-10-03 `null` وقتی `ALLOW_HARD_DELETE` خاموش است؛ `days_left` هم `null`) | B2، 2026-09-26: فقط `kind='session'`، فقط متادیتا؛ `days_left` تا حذفِ قدیمی‌ترین بخش (در SQL) | 401/403 |
| DELETE | `/api/admin/sessions/:id/audio` | — | `{deleted, bytes}` | B2: فقط صدایِ جلسه (ردیف‌هایِ `session_audio` همه‌ی kindها + پوشه + فایل‌هایِ صف)؛ جلسه/متن دست نمی‌خورد؛ `audit_log: admin.session_audio_delete` | 404، 409 `audio-pending` (صدایِ transcript/late/note هنوز در صف) |
| GET | `/api/admin/voice-notes` | query مثلِ بالا | `{items:[{session_id, session_num, date, status, client_id, client_code, therapist_id, therapist_name, last_at, notes:[{id, wall_clock, created_at, text_len, pre_session}], audio:[{id, bytes, duration_ms, created_at, pre_session}]}], has_more}` | B3: **بدونِ متن** (فقط طول)؛ جلسه‌ی دارایِ فقط صدایِ یادداشت هم می‌آید؛ **(2026-09-29)** یادداشت/صدایِ پیش از جلسه (`voice_before` / `kind='prenote'`) هم می‌آیند با `pre_session:true` | 401/403 |
| GET | `/api/admin/voice-notes/:noteId/text` | — | `{id, session_id, text}` | B3: متنِ یک یادداشتِ صوتی (از 2026-09-29 `voice_before` هم) فقط با کلیکِ صریح؛ `audit_log: admin.voice_note_text_view` | 404 |
| GET | `/api/admin/sessions/:id/timeline` | — | `{timeline:[{ts, lane:"server"\|"client"\|"ui"\|"audio"\|"note"\|"db", label, detail}]}` مرتب بر `ts` | ادغامِ `obs_events` + `obs_ui_events` + `listSessionAudio()` + متادیتایِ `session_notes` (بدونِ متن) + دو آیتمِ مصنوعیِ `created_at`/`updated_at`ِ خودِ جلسه | 404 owned نیست (جلسه) |
| GET | `/api/admin/obs/events` | `event?, severity?, therapist_id?, session_id?, source?, from?, to?, limit?` (≤۵۰۰) | `{events:[…]}` — همه‌ی ستون‌هایِ `obs_events` | فیلترهایِ اختیاری با الگویِ `(? IS NULL OR col=?)` |
| GET | `/api/admin/obs/ui-events` | `kind?, therapist_id?, session_id?, nav_id?, from?, to?, limit?` (≤۵۰۰) | `{events:[…]}` — همه‌ی ستون‌هایِ `obs_ui_events` | همان الگو |
| GET | `/api/admin/obs/stats` | — | `{daily_counts:[{day,event,count}] (۱۴ روزِ اخیر), queue:{event_queue_length, ui_queue_length, db_healthy, drain_interval_ms, total_enqueued, total_inserted, total_db_errors}, jsonl_files:[{name,bytes}], db_size_bytes:{obs_events,obs_ui_events}}` | آمارِ سلامتِ کاملِ لایه‌ی obs برایِ یک نگاه |
| GET | `/api/admin/sessions/live` | — | `{sessions:[{id, session_num, client_id, client_code, therapist_id, therapist_name, duration_ms, updated_at, auto_closed_at, segment_count, segment_bytes, last_segment_age_s, transcript_len, health:'recording'\|'quiet'\|'stalled'}]}` | (2026-10-01) جلساتِ `in_progress` از نوعِ `live` با `updated_at` در ۶ ساعتِ اخیر؛ فقط وضعیت، **بدونِ شنودِ زنده**. `health` از سنِ آخرینِ سگمنتِ صدا (`features/admin/liveHealth.ts`: <۲ دقیقه / ۲–۱۵ / >۱۵). بدونِ audit؛ بدونِ متن |
| GET | `/api/admin/queue` | `therapist_id?`، `stage?` | `{upload_jobs:[jobView + therapist_id/therapist_name، بدونِ original_name], final_transcripts:[{session_id, session_num, client_code, therapist_name, stage, attempts, error_code, queued_at, finished_at, next_attempt_at}], batch:[{session_id, batch_status, pending_files, …}], counts:{upload, final_transcript, batch}}` | (2026-10-01) صفِ پردازشِ سراسری، فعال یا ۱۴ روزِ اخیر؛ بدونِ متن و نامِ فایل |
| GET | `/api/admin/upload-quality` | `therapist_id?`، `days?` (۱–۱۸۰، پیش‌فرض ۳۰) | `{rows:[{job_id, session_id, session_num, client_code, therapist_id, therapist_name, created_at, duration_ms, metrics}], summary:{sessions, coverage_median, coverage_min, low_conf_median, flagged, flag_counts}, days}` | (2026-10-01، Session Data Engine) «کیفیتِ رونویسی»: جلساتِ آپلودیِ دارایِ `audio_jobs.transcript_metrics`، بدترین اول (تعدادِ پرچم، بعد پوششِ کمتر)، حداکثر ۵۰۰؛ فقط عدد/پرچم، بدونِ متن/نامِ فایل/`speech_spans` | — |
| GET | `/api/admin/core-metrics` | `days?` (۱–۳۶۵، پیش‌فرض ۳۰)، `therapist_id?` | `{window_days, capture_reliability:{live_sessions, realtime_reliable_rate, text_captured_rate, audio_saved_rate, mic_lost_events, health_problem_events, live_lock_denied_events}, recovery_success:{reconnect_ok, reconnect_exhausted, reconnect_success_rate, gap_marked, silent_ws_detected, batch_completed, batch_failed, segment_unrecoverable, batch_success_rate}, correction_rate:{sessions, revised_sessions, revision_rate, role_edited_sessions, role_edit_rate}, repeat_usage:{active_therapists, returning_therapists, returning_rate, weekly_active_therapists, sessions_per_active_therapist}}` — **فقط عدد/نسبت** (`null` وقتی مخرج صفر)؛ metricهایِ §۱۴ product-thesis (F10، 2026-10-02) | 401/403 | UI ادمین «سنجه‌هایِ هسته» |
| POST | `/api/admin/audio-jobs/:id/retry` | — | `{ok:true}` | (2026-10-01) همان منطقِ retryِ تراپیست (`audio-upload/jobRetry.ts`) بدونِ قیدِ مالکیت؛ `recordAudit('admin.audio_job_retry')`. خطاها: 404، 409 `not-failed`، 410 `audio-expired`، 422 |
| POST | `/api/admin/sessions/:id/final-transcript/retry` | — | `{ok:true}` | (2026-10-01) `retryFinalTranscript`؛ `recordAudit('admin.final_transcript_retry')`. 404 `not-found`، 409 `busy`/`fresh` |
| GET | `/api/admin/system` | — | `{uptime_s, started_at, node, db:{ok, ping_ms, size_bytes}, disk:{free_bytes, total_bytes, dirs:[{name,bytes}], dirs_cached_at}, workers:[{name, status:'ok'\|'stale'\|'unknown', interval_ms, age_s, count, last_error}], http:{buckets:[48×{start,count,c4xx,c5xx}], total, c4xx, c5xx, error_rate_5xx, p50_ms, p95_ms}, obs:{queue, events_24h:{error,warn}}, llm_unavailable_24h}` | (2026-10-01) سلامتِ سیستم. هر بخش fail-open؛ `http` درون‌حافظه‌ای از آخرین راه‌اندازی (حداکثر ۲۴ ساعت)؛ حجمِ پوشه‌هایِ `data/` با کشِ ۵ دقیقه‌ای |

## ۸. AI Case File — `server/src/features/case-file/api/caseFile.routes.ts` (همه `auth`) — جدید، 2026-09-17

پرونده‌ی روندِ درمان — سنتزِ LLM از رویِ `sessions.transcript`/`session_notes` همان مراجع.
فازِ ۱: بدونِ auto-trigger؛ فقط دکمه‌ی دستی. Backend/schema generic (بدونِ شرطِ status)؛
UIِ فعلی فقط برایِ `status='inactive'` رندر می‌شود. جزئیاتِ معماری: [08-ai-case-file](../04-modules/08-ai-case-file/module-prd.md).

| Method | Path | Body | موفق | خطاها | مصرف |
|---|---|---|---|---|---|
| GET | `/api/clients/:id/case-file` | — | `{case_file: CaseFileRecord \| null, treatment_rhythm: TreatmentRhythm}` | 404 owned | UI |
| GET | `/api/clients/:id/case-file/versions` | — | `{versions:[{id, content_version, status, model, created_at, chars}]}` — محتوایِ قبلیِ پرونده پیش از هر بازنویسی (migration 044؛ حداکثر ۱۰۰، فقط متادیتا) | 404 owned | بازیابی |
| POST | `/api/clients/:id/case-file/versions/:vid/restore` | — | `{case_file}` — بازگردانیِ یک نسخه؛ محتوایِ فعلی هم پیش از جایگزینی ذخیره می‌شود (برگشت‌پذیر) | 404 | بازیابی |
| POST | `/api/clients/:id/case-file/regenerate` | `{force?: boolean, confirmPhrase?: string}` — وقتی `force:true`، `confirmPhrase` باید دقیقاً `"بازتولید کامل"` باشد | `{case_file: CaseFileRecord, skipped: boolean, treatment_rhythm: TreatmentRhythm}`؛ همزمان (منتظر می‌ماند تا فراخوانیِ LLM تمام شود)؛ اگر امضایِ کورپوس (§جدید 2026-09-17) با آخرین تولید یکسان بود و `force` نبود، **بدونِ فراخوانیِ LLM** همان رکورد با `skipped:true` برمی‌گردد؛ `force=true` یعنی فیلدهایِ `reviewedByTherapist` هم دور ریخته می‌شوند (`force_regenerated_at/by` ثبت می‌شود) | 400 (`force:true` بدونِ `confirmPhrase` درست)، 404 owned، 409 `{error, code:"busy"}` اگر تولیدِ دیگری کمتر از ۳ دقیقه پیش شروع شده (race)، 502 `{error, code}` (`llm-failed`\|`llm-invalid-output`\|`unknown`) اگر LLM ناموفق/خروجیِ نامعتبر بدهد | UI |
| PATCH | `/api/clients/:id/case-file` | `{fieldId, action:"edit"\|"approve"\|"accept-suggestion"\|"dismiss-suggestion"\|"pin"\|"unpin"\|"move", value?}` — **جدید 2026-09-20:** `fieldId="finding.<id>"` با `pin`/`unpin` (نکته‌ی کلیدی، حداکثر ۳؛ بیش از سقف ⇒ ۴۰۰ «حداکثر 3 نکته‌ی کلیدی»؛ یافته‌ی ناموجود ⇒ ۴۰۰ «یافته یافت نشد») یا `move` (جابه‌جاییِ یافته‌ی محور؛ `value="<axisId>:<role>"`؛ فقط یافته‌ی محور — نه زوجین/خانواده؛ نقش/محورِ نامعتبر ⇒ ۴۰۰) — schemaِ `fieldId` در `application/applyFieldPatch.ts` (شاملِ `identity`\|`mainIssue`\|`overallStatus`\|`safetyRisk`\|`sensitiveContext`\|…). **جدید 2026-09-22:** `fieldId="medication.<id>.name"` با `action:"edit"` — فقط برایِ ردیفِ دستیِ `addedByTherapist:true` (وگرنه ۴۰۰ «فقط نامِ دارویِ افزوده‌شده‌یِ دستی قابلِ ویرایش است»)؛ `name` یک `string` ساده است، نه `CaseFileField` (بدونِ source/approve/suggestion) | `{case_file: CaseFileRecord}` | 400 (fieldId/action نامعتبر یا ناسازگار)، 404 (owned یا پرونده هنوز نساخته) | UI |
| POST | `/api/clients/:id/case-file/items` | `{kind:"axis"\|"medication"\|"roadmap", title\|name\|question, statusTone?, priority?, why?}` — **جدید 2026-09-22:** برایِ `kind:"medication"`، `dose?`/`frequency?`/`lastChange?`/`prescriber?` هم پذیرفته می‌شوند (اختیاری، بدونِ خطا اگر خالی؛ حداکثر ۱۲۰ نویسه) | `{case_file}` — ردیفِ دستی با `addedByTherapist:true` (در regenerate حفظ می‌شود؛ p1 مجاز نیست ⇒ p3) | 400، 404 owned/پرونده | UI (2026-09-19، UI مودال 2026-09-22) |
| POST | `/api/clients/:id/case-file/upgrade` | — | `{case_file, upgraded:number}` — **جدید 2026-09-20:** بدونِ LLM/بازتولید؛ فقط کارِ دست‌نخورده‌یِ AI را به ساختارِ «یافته» ارتقا می‌دهد (`application/upgradeLegacyContent.ts`)؛ ایدمپوتنت | 404 |
| DELETE | `/api/clients/:id/case-file/items/:kind/:itemId` | — | `{case_file}`؛ فقط ردیفِ `addedByTherapist` | 400 (ردیفِ AI/نامعتبر)، 404 | UI (2026-09-19) |

`CaseFileRecord` = `{clientId, content, status:"ready"|"generating"|"error"|"stale", generatingStartedAt, model, promptVersion, generatedAt, generatedFromSessionId, corpusSignature, therapistEditedAt, forceRegeneratedAt, forceRegeneratedBy, errorMessage}`؛ ساختارِ `content` در [database-catalog §client_case_file](database-catalog.md). `corpusSignature`/`generatingStartedAt` ستون‌هایِ migration 019 (2026-09-17) — به ترتیب برایِ ردِ regenerateِ بدونِ داده‌ی جدید و قفلِ نرمِ race.

`content` (2026-09-18) سه فیلدِ سطحِ‌بالایِ جدید هم دارد (همه از جنسِ `CaseFileField`؛ `application/computeTreatmentRhythm.ts`/`prompts/userPrompts.ts`): `overallStatus` (خلاصه‌ی کلیِ AI برایِ status-pillِ هدر)، `safetyRisk` (هشدارِ ایمنی/خطرِ جانی — مفهوماً جدا از `axis.sensitiveDoNotDiscussInFrontOfClient`)، `sensitiveContext` (خلاصه‌ی زمینه‌ی حساسِ پرونده). هر سه فقط وقتی متن واقعاً پشتیبان دارد پر می‌شوند؛ در غیرِ این صورت `pending:true`/`value:""` و UI بنری نشان نمی‌دهد.

`TreatmentRhythm` = `{sessionCount: number, startDate: string|null, avgGapDays: number|null, durationDays: number|null}` — **محاسبه‌ای، نه از LLM** (`application/computeTreatmentRhythm.ts`، از رویِ `sessions.date`ِ جلساتِ `completed`/`recovered`)؛ همیشه زنده است، حتی بدونِ regenerate کردنِ پرونده. `startDate` شمسیِ `YYYY/MM/DD`؛ `avgGapDays`/`durationDays` فقط با ≥۲ جلسه‌ی تاریخ‌دار محاسبه می‌شوند، وگرنه `null` (UI: «در انتظار ثبت»).

**تغییرِ 2026-09-23 (رفعِ F6):** `CaseFileRecord.contentVersion` اضافه شد (CAS). PATCH/items/DELETE/upgrade در تعارضِ هم‌زمان (نسخه بینِ خواندن و نوشتن عوض شد) تا ۵ بار رویِ آخرین نسخه دوباره اعمال می‌شوند؛ اگر باز هم نشد ⇒ `409 {code:"version-conflict"}`. regenerate قفل را اتمیک می‌گیرد (همان `409 busy`).

## ۸.۱ آپلودِ فایلِ صوتی، jobها، اعلان‌ها — `server/src/features/audio-upload/uploads.routes.ts` (همه `auth`، owned) — جدید 2026-09-23

جزئیاتِ رفتار: [subsystem 06](../07-subsystems/06-audio-upload-pipeline.md). مصرف: `feelia-upload.js` (UP) و `index.html` (UI).

| Method | Path | Body | موفق | خطاها | مصرف |
|---|---|---|---|---|---|
| POST | `/api/uploads` | `{client_id, file_name, size, mime?, fingerprint (hex 32–128), session_date? (شمسی), consent:true}` | 201 `{upload}` تازه؛ 200 `{upload, resumed:true}` (همان آپلودِ نیمه‌کاره، با `received:number[]`)؛ 200 `{upload, duplicate:true, requeued, job}` (از 2026-09-24: اگر jobِ آن آپلود `failed` و قابلِ ادامه باشد، همان job دوباره در صف می‌رود و `requeued:true`؛ اگر غیرقابلِ ادامه باشد — صدا دیگر نیست یا فایلِ مشکل‌دار — duplicate نیست و آپلودِ تازه ساخته می‌شود) | 400 `consent-required`/`file-too-small` (یا `size` غیرِ integer)/`bad-fingerprint`/تاریخِ نامعتبر، 404 owned، 413 `file-too-large` (>۱GB)، 415 `unsupported-format` (پسوند خارج از allowlist **و** MIME غیرِ `audio/*`/`video/*`)، 429 `too-many-uploads` (>۵ نیمه‌کاره؛ پیش از 429 آپلودهایِ نیمه‌کاره‌ی بی‌فعالیت > ۲۴ساعت خودکار `canceled`/`expired` می‌شوند)، 507 `server-storage-full` | UP |
| GET | `/api/uploads/:id` | — | `{upload, job\|null}` | 404 | — |
| PUT | `/api/uploads/:id/chunks/:n` | بایتِ خام `application/octet-stream` (دقیقاً `chunk_size`=۴MB، تکه‌ی آخر باقی‌مانده)؛ هدرِ اختیاریِ `X-Chunk-Sha256` | `{ok:true, n}` — idempotent | 400 `bad-chunk-index`/`bad-chunk-size`، 404، 409 `upload-closed`، 422 `chunk-corrupt` | UP |
| POST | `/api/uploads/:id/complete` | — | 201 `{upload, job}` (جلسه‌ی `source='upload'` + job، اتمیک)؛ اگر قبلاً complete شده 200 همان | 404، 409 `chunks-missing` (+`missing[]` کامل؛ پیش از 2026-09-24 حداکثر ۵۰) / `upload-closed`، 422 `not-audio`/`no-audio`/`unreadable`/`too-long`، 500 `assemble-failed` | UP |
| DELETE | `/api/uploads/:id` | — | `{canceled}` | 404، 409 `upload-closed` | UP |
| DELETE | `/api/upload-groups/:groupId` | — (2026-09-25، migration 025) | `{canceled: n}` — بخش‌هایِ `uploading` و بخش‌هایِ رسیده‌ی بدونِ جلسه ⇒ `canceled`/`group-canceled` + حذفِ پوشه؛ گروهی که جلسه‌اش ساخته شده دست نمی‌خورد (0) | — | UP |

**چندبخشی (2026-09-25، migration 025):** `POST /api/uploads` سه فیلدِ اختیاریِ هم‌زمان می‌پذیرد: `group_id` (UUIDِ ساخته‌ی کلاینت)، `part_index` (۰‌مبنا)، `parts_total` (۲..۱۰). ادامه/تکراری با کلیدِ (گروه، شماره‌ی بخش) — نه fingerprint؛ fingerprintِ متفاوت ⇒ 409 `part-mismatch`؛ بخشِ رسیده‌ی منتظر ⇒ 200 `{upload, part_done:true}`؛ گروهِ لغو/ردشده ⇒ 409 `group-closed`؛ فیلدِ نامعتبر ⇒ 400 `bad-part`. `complete`ِ یک بخش: بررسیِ همان فایل مثلِ قبل، بعد 200 `{upload, part_done:true, parts_received, parts_total}` تا وقتی همه‌ی بخش‌ها برسند؛ آخرین بخش ⇒ 201 `{upload, job}` (یک جلسه + یک job برایِ همه‌ی بخش‌ها)؛ مجموعِ مدت > ۳۰۰ دقیقه ⇒ 422 `too-long` برایِ کلِ گروه. `uploadView` حالا `group_id`/`part_index`/`parts_total` و `jobView` حالا `parts_total` دارد. آپلودِ تک‌فایلی بدونِ تغییر.
| GET | `/api/audio-jobs?scope=active\|recent` | — | `{jobs: AudioJobView[]}` (active = فعال یا تمام‌شده در ۱۰ دقیقه‌ی اخیر؛ recent = ۱۴ روز؛ حداکثر ۳۰) | — | UI |
| GET | `/api/audio-jobs/:id` | — | `{job}` | 404 | — |
| POST | `/api/audio-jobs/:id/retry` | — | `{job}` — بدونِ آپلودِ دوباره (از نسخه‌ی نرمال‌شده/خامِ رویِ سرور) | 404، 409 `not-failed`، 410 `audio-expired`، 422 (خطایِ دائمیِ فایل: `unreadable`/`no-audio`/`too-long`/`audio-missing`/`audio-expired` — از 2026-09-24 بدونِ استثنایِ «نسخه‌ی نرمال‌شده موجود») | UI |
| GET | `/api/sessions/:id/audio-job` | — | `{job\|null}` آخرین jobِ جلسه | 404 owned | UI |
| GET | `/api/notifications` | — | `{notifications[30], unread}` — `kind` شاملِ `transcript_low_quality` (2026-09-28: متن ذخیره شد ولی کم‌اطمینان) — هر ردیف `{id, kind, client_id, session_id, job_id, error_code, created_at, read_at, client_code, client_alias, session_num}` | — | UI |
| POST | `/api/notifications/read` | `{ids?: string[] (≤100)}` یا `{all:true}` | `{ok:true}` | — | UI |

`AudioJobView` = `{id, stage:"queued"|"normalizing"|"transcribing"|"case_file"|"done"|"failed", attempts, error_code, duration_ms, case_file_status, transcript_ready, transcript_chars, created_at, updated_at, finished_at, next_attempt_at, session_id, session_num, client_id, client_code, client_alias, client_status, case_file_planned, original_name, parts_total, quality_flags, quality_warning, transcript_notes}` (2026-10-01: `transcript_notes` = زیرمجموعه‌ی `transcript_metrics.flags` برایِ تراپیست: `low_coverage|uncovered_gap|head_gap|tail_gap|speakers_merged` — فقط نام، عدد نه) (2026-09-28، پلنِ B / migration 033: `quality_flags` = فهرستِ `no_signal|too_quiet|clipping|noisy` (فقط «علتِ احتمالی»، سنجه‌یِ عددی نه)؛ `quality_warning` = `"low_confidence"|null` — سهمِ توکن‌هایِ کم‌اطمینانِ Soniox > `UPLOAD_LOW_CONF_RATIO`) (2026-09-25: `client_status` وضعیتِ فعلیِ مراجع؛ `case_file_planned` = خروجیِ `uploadCaseFileAllowed` با وضعیتِ فعلی — UI پیش از ثبتِ متن با آن مرحله‌ی «پرونده» را نشان می‌دهد؛ پیش‌فرض false).

**تغییرِ مرتبط:** `GET /api/clients/:id` حالا `sessions[].batch_status` هم برمی‌گرداند؛ `PUT /api/sessions/:id` پاک‌کردنِ تاریخ را برایِ `source='upload'` هم می‌پذیرد (مثلِ `manual`).

## ۸.۲ واحدِ درمان — `server/src/features/treatment-unit/api/treatmentUnit.routes.ts` (همه `auth`) — جدید 2026-09-27

| متد | مسیر | بدنه / خروجی |
|---|---|---|
| GET | `/api/catalog/treatment-units` | `{unit_types[], roles[], modalities[]}` — کاتالوگِ داده‌محور؛ فرانت فرم را از آن می‌سازد |
| GET | `/api/clients/:id/unit` | owned (404). `{unit:{unit_type, members:[{id,role,alias,category,gender,label}]}}` — مراجعِ بدونِ عضو ⇒ عضوِ ضمنیِ `id:"self"` |
| PUT | `/api/clients/:id/unit` | `{unit_type, members[]}` — تغییر/ارتقا؛ عضوِ با `id` موجود حفظ می‌شود. 400 با `code`: `unit-type-invalid`، `members-count`، `member-role-invalid`، `member-category-invalid`، `member-gender-invalid`، `alias-too-long` |
| GET/PUT | `/api/therapist/modalities` | `{modalities:[code]}` — 400 `modalities-invalid`/`modality-unknown` |

**تغییرِ مسیرهای موجود:** `POST /api/clients` — اختیاری `unit_type` + `members` (همان خطاهایِ 400 بالا، پیش از INSERT)؛ پاسخ `unit` هم دارد. `GET /api/clients` — `unit_type`، `member_count`. `GET /api/clients/:id` — `unit`. `POST /api/sessions` (زنده) — اختیاری `attendees:[memberId]` (نبود/همه ⇒ NULL؛ 400 `attendees-invalid`/`attendees-empty`/`attendees-unknown`) و `pre_note` (400 `pre-note-too-long`). **(2026-09-29)** `pre_note` دیگر در ستونِ `sessions.pre_note` نوشته نمی‌شود: در همان تراکنشِ ساختِ جلسه یک ردیفِ `session_notes(type='note_before', wall_clock=start_time)` می‌سازد (قابلِ ویرایش با `PATCH /api/notes/:id`، واردِ پرونده). ستونِ قدیمی فقط خوانده می‌شود (`GET /api/sessions/:id`، `GET /api/admin/sessions/:id` ⇒ `session.pre_note`). `POST /api/stt/realtime-session` — `stt_defaults.context` حالا مخصوصِ جلسه است (fail-open به contextِ ثابت).

## ۸.۳ متنِ نهایی — `server/src/features/final-transcript/api/finalTranscript.routes.ts` (همه `auth`) — جدید 2026-09-27

| متد | مسیر | بدنه / خروجی |
|---|---|---|
| GET | `/api/sessions/:id/final-transcript` | owned (404). `{enabled, stage, source, stale, clean_text (فقط done), turns, roles, speaker_edit, error_code, report:{chunks,fallback_chunks,turns,fallback_turns,uncertain}}` — بدونِ ردیف ⇒ `{enabled, stage:null}`. **(2026-09-28، migration 034)** `turns` = `[{role, text, raw?, sp?, marker?}]` (فقط done؛ ردیفِ قدیمی ⇒ `null`)، `roles` = نقش‌هایِ مجاز (حاضرینِ واحدِ درمان)، `speaker_edit` = `source==='async'` (شماره‌ی گوینده در کلِ جلسه یکدست است) |
| PATCH | `/api/sessions/:id/final-transcript/roles` | **جدید 2026-09-28.** owned (404). body `{indices:number[], role, same_speaker?}` ⇒ `{clean_text, turns, changed}`. فقط نقش عوض می‌شود، نه متن. `same_speaker` فقط وقتی `source=async` اثر دارد (همه‌ی نوبت‌هایِ همان `sp`). 400 `bad-role`/`bad-index`، 409 `not-editable` (نه done یا بدونِ `turns`)، 409 `conflict` (هم‌زمان دوباره ساخته شد). رویداد: `final_transcript.role_edit` (`count`، `mode=turn\|speaker`) |
| POST | `/api/sessions/:id/final-transcript/retry` | owned (404). failed/skipped یا doneِ stale ⇒ دوباره در صف (`{ok:true}`). بدونِ ردیف ⇒ enqueue (409 `session-not-completed`، 403 `forbidden` اگر قابلیت خاموش است). 409 `busy` (در جریان)، 409 `fresh` (doneِ به‌روز) |


**روشن/خاموش فقط از ادمین** (تصمیمِ مالک 2026-09-28؛ `PATCH /api/auth/final-transcript` حذف شد). **تغییرِ مسیرهای موجود:** `GET /api/auth/me`، login و register — فیلدِ `final_transcript_enabled`. `GET /api/admin/therapists` — `final_transcript_enabled`. `PATCH /api/admin/therapists/:id` — اختیاری `final_transcript_enabled` (audit: `purpose=final_transcript_on/off`). `GET /api/notifications` — kindِ جدیدِ `final_transcript_ready`؛ از 2026-09-28 `llm_unavailable` (فقط ادمین‌ها، `error_code` = `credit\|auth\|unavailable`، بدونِ مراجع/جلسه).

## ۹. WebSocket (LEGACY — LAW-015) — `server/src/features/legacy-ws/transcription.routes.ts`

هر دو مسیر پشتِ `requireAuth` (کوکی در upgrade) و مالکیتِ جلسه.

### `/ws/t/:sessionId` — جلسه‌ی زنده با پروتکلِ P1

| جهت | پیام | معنا |
|---|---|---|
| C→S | `{"type":"hello","clientId"}` | handshake؛ پاسخ `resumed` |
| C→S | `{"type":"chunk-meta","seq":n}` سپس frameِ باینری | هر chunk با seq (از ۱ در هر نسل) |
| C→S | باینری بدونِ meta | legacy؛ سرور seq تخصیص می‌دهد |
| C→S | `{"type":"pause"}` / `{"type":"resume"}` | توقف/ادامه‌ی دستی |
| C→S | `{"type":"finalize"}` | پایان → `completed` |
| C→S | `{"type":"cancel"}` | `canceled` |
| C→S | `{"type":"close-hint","intent":"close"}` | beacon در `beforeunload` |
| S→C | `{"type":"ack","ackSeq"}` | تحویل به transport Soniox (نه durable) |
| S→C | `{"type":"resumed","generation","resumePoint","hint"}` | |
| S→C | `{"type":"paused"}` | |
| S→C | `{"type":"status","status","message"}` | connecting/connected/reconnecting/error |
| S→C | `{"type":"preview","text","confirmed","hint"}` | |
| S→C | `{"type":"finished","finalText"}` | |
| S→C | `{"type":"error","message"}` | |

### `/ws/voice/:sessionId` — یادداشتِ صوتیِ زنده
C→S: باینری، `{"type":"finalize"}`. S→C: `preview{text}`، `status`، `finished{finalText}`، `error`. نتیجه‌ی غیرخالی → `session_notes(type='voice')`.

جزئیاتِ ordering: [subsystem 04](../07-subsystems/04-legacy-ws-proxy-p1.md).

## ۱۰. Soniox (خارجی) — پیام‌هایی که کلاینت پردازش می‌کند
[integration-architecture §2](../01-architecture/integration-architecture.md).
