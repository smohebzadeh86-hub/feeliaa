# Verification — بازسازیِ ماژولارِ backend، اجرایِ دوم (v2) — 2026-09-28

> **نوع:** Evidence (مشاهده در یک زمان). شاخه‌ی محلیِ `refactor/backend-modular-v2` (worktree `.claude/worktrees/bm2`)، پایه `65b264c`
> (سرِ `feat/clarity` در 2026-09-28). push/merge/deploy **نشده**.
> **چرا v2:** اجرایِ اول (`refactor/backend-modular`، پایه `538b30f`، 2026-09-27) از `feat/clarity` عقب افتاد (llm/، final-transcript،
> treatment-unit، کیفیتِ آپلود، signMarkers، Metis). به تصمیمِ مالک («گزینه الف») همان پلن از روی کدِ امروز دوباره اجرا شد؛ اسکریپت‌هایِ
> v1 بازپخش و با drift تطبیق داده شدند. شاخه‌ی v1 دست‌نخورده باقی است (فقط مرجع).

## ۱. گیت‌ها — بعد از **هر** commit سبز

| گیت | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | PASS |
| مجموعه‌ی رشته‌هایِ SQL (`sqlcheck`، مقایسه با `65b264c`) | **distinct یکسان: 256 → 256** (تکراری‌هایِ ادغام‌شده مجاز؛ کل 288 → 277) |
| `pnpm test:rt` | 100/100 |
| `pnpm test:cf` | 110/110 |
| `pnpm test:up` | 52/52 |
| `pnpm test:tu` | 17/17 |
| `pnpm test:ft` | 59/59 |
| `pnpm test:llm` | 18/18 |
| `pnpm test:routes` | 126 route — یکسان با snapshotِ کدِ اصلی |
| `pnpm test:api` (DBِ dev، fixtureِ ساختگی، Sonioxِ mock) | **349/349 یکسان با golden** (goldenِ تولیدشده از `10d5761`=P1) |
| `pnpm test:arch` (از P6) | 140 فایل، 348 importِ استاتیک، بدونِ چرخه؛ mutation-check: R1، R2، R6 گرفته شدند |
| boot smoke | `index.ts`ِ واقعی رویِ پورتِ 3999، cwd در scratchpad، فقط `DATABASE_URL` (بدونِ کلیدِ Soniox/LLM، `PROXY_URL` پاک): ۳۴ migration «already applied»، workerها شروع شدند، `listen` OK، `GET /api/health` ⇒ `ok` + `database: connected`. پیش از اجرا شمارشِ همه‌ی ردیف‌هایِ مشمولِ sweep/workerهایِ startup (جلسه‌ی باز، jobِ آپلود/متنِ نهاییِ فعال، آپلودِ نیمه‌کاره، اعلان/obs/auditِ قدیمی) = **۰**. |
| promptهایِ پرونده (P4) | system + digest/compose user prompt قبل/بعد رشته‌به‌رشته برابر |
| تقسیمِ batchQueue / sessionAudioArchive (P5) | هر خطِ کدِ دو فایلِ قدیم در فایل‌هایِ جدید هست (بجز `export ` و specifierِ import) |

## ۲. commitها

| فاز | commit | خلاصه |
|---|---|---|
| P1 | `10d5761` | `app.ts` (buildApp) + `jobs/backgroundJobs.ts` + route snapshot + API contract harness (گسترش‌یافته برایِ treatment-unit، final-transcript، `final_transcript_enabled`) |
| P2 | `e68e7eb` | `shared/` (keyedLock، rateLimit، persianDigits، ffmpeg، httpRange) + `soniox/config`؛ `FFMPEG_BIN`ِ `audio-upload/quality.ts` هم |
| P3 | `a3d8c3a` | `http/`، `stt/`، `ws/` ⇒ `features/*` (+ `signMarkers.ts`)؛ APIِ اعلان‌ها جدا در همان scopeِ parserِ آپلود |
| P4 | `02ad9b5` | jalali، sessionNumber، sonioxRefs، session-media/purge، case-file composition/CAS/prompts (یک adapterِ `chatLlm`) |
| P5 | `53431cb` `f5e7ae1` `cd234b7` `bb62418` `8d2b779` `6503031` | auth، clients، sessions، admin، audio-upload، transcription: repositoryها و تقسیمِ فایل‌هایِ بزرگ |
| P6 | `e0a65a4` | `index.ts`ِ عمومی، `test:arch`، حذفِ کدِ مرده (`export default pool`، `queueDir()`) |
| P7 | (همین commit) | مستندات |

## ۳. تفاوت‌ها با v1 (تطبیق با کدِ امروز)

1. **drift در بلوک‌هایِ جابه‌جاشده** عیناً منتقل شد: ستونِ `final_transcript_enabled` (auth/admin)، `unit_type`/`member_count` و
   `treatmentUnits` (clients)، `attendees`/`pre_note` و enqueueِ متنِ نهایی (sessions، autoClose)، کیفیت/کم‌اطمینانی/متنِ نهایی
   (`jobStore.sql.ts`، `worker.ts`)، `audio_quality`/`quality_warning` در `JOB_SELECT` (`uploads.repository.ts`)، contextِ واحدِ درمان در batch.
2. **`features/transcription/sessionContext.ts` ⇒ `shared/sessionSttContext.ts`** (ثابتِ بدونِ import): با importِ از `index.ts`
   چرخه‌ی transcription → speakerResolve → treatment-unit → instance → transcription پیدا می‌شد؛ در کدِ اصلی وابستگی به همین فایلِ برگ بود.
3. `treatment-unit` و `final-transcript` از ابتدا routeها را از `index.ts` export می‌کردند و همان‌طور ماندند (R3 می‌پذیرد).
4. `scripts/final-transcript-harness.ts` ثابتِ `UPLOAD_TRANSCRIPT_LABEL_PREFIX` را از مسیرِ جدید (`jobStore.sql.ts`) می‌خواند.
5. اعلان‌ها: `notifyAdmins` هم از `features/notifications/index.ts` export می‌شود (مصرف: `jobs/backgroundJobs.ts`).

## ۴. FINDINGها (گزارش؛ **هیچ‌کدام رفع نشد** — بازبینی‌شده رویِ کدِ امروز)

1. `POST /api/sessions` شماره‌ی جلسه را بدونِ `FOR UPDATE` می‌گیرد (مسیرِ آپلود با `FOR UPDATE`) — `sessions.repository.ts#nextSessionNum`.
2. ~~legacy-ws بدونِ bumpِ `transcript_version`~~ — **در کدِ پایه (`65b264c`) رفع شده** (`transcription.routes.ts` حالا version را bump می‌کند).
3. `DELETE /api/clients/:id` هیچ `logEvent`ی ثبت نمی‌کند؛ حذف‌هایِ ادمینِ تراپیست/مراجع `rowCount` را چک نمی‌کنند.
4. `legacy-ws/soniox.ts` متغیرِ `SONIOX_WS_URL` را نادیده می‌گیرد (URLِ ثابت).
5. Mapهایِ قفل (`createKeyedLock`) و `p1.records` هرگز پاک نمی‌شوند.
6. LAW-001/LAW-023 هنوز لاگِ `DIAG-TEMP` را ذکر می‌کنند که در کد نیست؛ LAW-021 هنوز `client_encoding=UTF8` (MySQL: `utf8mb4`).
7. `session_audio` کلیدِ `UNIQUE(session_id, run_id, seq)` دارد ولی `seq` جدا برایِ هر `kind` شمرده می‌شود (یادداشتِ صوتی و سگمنتِ هم‌run ⇒ `Duplicate entry`).
8. `POST /api/notifications/read` با `Content-Type: application/octet-stream` پاسخِ 200ِ بی‌اثر می‌دهد — عمداً حفظ شد.
9. کامنتِ migrationِ اعمال‌شده‌ی `013_session_date_jalali.*` به `server/src/http/sessionDate.ts` اشاره می‌کند (LAW-007 ⇒ ویرایش نشد؛ مسیرِ درست `shared/jalali.ts`).
10. حدودِ ۲۵ ردیفِ ناشناسِ `obs_events` در هر اجرایِ `test:api` در DBِ dev می‌ماند (بدونِ شناسه/PII).

## ۵. رویدادِ DBِ dev

- DBِ dev migrationِ `034_final_transcript_turns.sql` (افزایشی، ستونِ `clean_turns`) را نداشت و ساختِ golden با `Unknown column` شکست خورد؛ با
  `runMigrations()`ِ خودِ اپ اعمال شد (همان کاری که `pnpm dev` در بوت می‌کند). production لمس نشد.

## ۶. آنچه عمداً انجام نشد

رفعِ FINDINGها؛ تغییرِ محتوایِ legacy-ws یا voice-note (LAW-015)؛ ادغامِ کلاینت‌هایِ HTTPِ Soniox یا runnerهایِ ffmpeg؛ جابه‌جاییِ `db/`
یا migrationها؛ `server-deploy/`؛ push/merge/deploy.

## ۷. کارِ باز برایِ merge

- هر commitِ تازه رویِ `feat/clarity` بعد از `65b264c` که `server/src` را لمس کند باید با [نقشه‌ی مسیرها](../docs/02-reference/repository-map.md)
  به فایل‌هایِ جدید منتقل و گیت‌ها دوباره اجرا شوند (ریسکِ R22 در Master Reference).
- پوشه‌ی موقتِ `.claude/worktrees/bm-golden` (از v1) هنوز هست — حذف توسطِ safety-checkِ محیط رد شد؛ مالک:
  `git worktree remove --force .claude/worktrees/bm-golden`.
- golden (`v2-golden.jsonl`) و ابزارهایِ مقایسه در scratchpadِ این نشست‌اند (نه در repo).
