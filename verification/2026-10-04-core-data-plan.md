# 2026-10-04 — اجرایِ core-data-plan (قدم‌های ۱ تا ۸)

> Evidence (مشاهده در یک زمان). پلن: [core-data-plan-2026-10-03](../docs/05-plans/core-data-plan-2026-10-03.md). به دستورِ مالک: «به ترتیب همه رو انجام بده».
> working treeِ `feat/clarity` (commit/deploy **نشد**). migrationهایِ 045 و 046 رویِ **DBِ مشترکِ dev** اعمال شدند؛ production دست نخورد.
> دادهٔ مراجعِ واقعی استفاده نشد: fixtureِ canary (`@example.invalid`، رمزِ غیرقابلِ‌استفاده) + صدایِ ساختگیِ TTS (`conv2w.wav`، دو گوینده) + تُنِ ffmpeg. همه پاک شدند.

## ۱. آنچه پیاده شد
| قدم | خلاصه | محل |
|---|---|---|
| ۱ | جدولِ ریسک: R4/R15/R16 بسته، R17 دقیق‌تر (logout هنوز باز)، **R24** (نگهداریِ بی‌مدت + حذفِ نرم ↔ متنِ رضایت)؛ کامنت‌هایِ «۱۴ روز» | `PROJECT_MASTER_REFERENCE.md` §22، `feelia-rt.js`، `archive/sweep.ts` |
| ۲ | **رکوردِ realtime** از توکن‌هایِ finalِ زنده (بدونِ هزینه‌ی Soniox) | `feelia-rt.js` (`captureRtToken`/`flushRtTokens`/`audioClockMs`)، `session-record/rtChunks.ts`، `POST /api/sessions/:id/rt-tokens`، migration 045، `buildRealtimeRecord` |
| ۳ | پیشنهادِ نقشِ گوینده (متنِ نهایی/حدسِ دونفره) + `display` + اعضایِ واحدِ درمان | `session-record/suggest.ts`، `final-transcript/adapters/speakerRoles.ts`، `app.ts`، `renderSpeakerRoles` |
| ۴ | سنجه‌یِ کیفیت برایِ هر گذر + نمایش به تراپیست و ادمین | `audio-upload/recordMetrics.ts`، migration 046، `audio-status.transcript_quality`، `adminQuality.ts` |
| ۵ | T59: سگمنتِ لحظه‌ی قطع با interim ⇒ رونویسی + حذفِ هم‌پوشانی در سرور | `scheduleReconnect`، `recoveryMerge.ts#trimOverlapWithPreceding` |
| ۶ | ابزارِ WER/DER آفلاین | `scripts/eval-asr.mjs` (`pnpm eval:asr`، `pnpm test:eval`) |
| ۷ | A/B صدایِ خامِ آرشیو (flagِ `localStorage.feelia_durable_raw`) | `feelia-rt.js` (`reqRawStream`/`durableSource`) |
| ۸ | E2E (این سند) | — |

## ۲. یافته‌هایِ حینِ کار (رفع شدند)
- **FINDING (از نشستِ قبلی):** شش رویدادِ کلاینتِ فاز ۱–۳ (`rt.watchdog_silent`، `rt.health_problem`، `rt.durable_start_failed`، `rt.mic_muted/unmuted`، `rt.live_lock_denied`) در `OBS_CLIENT_EVENTS` نبودند ⇒ سرور بی‌صدا drop می‌کرد و کاشی‌هایِ `core-metrics` همیشه صفر بودند. به allowlist اضافه شدند؛ `silent_ms` (کلیدِ غیرمجاز) ⇒ `elapsed_ms`.
- **E2Eِ واقعی:** Soniox در realtime توکن‌هایِ کنترلیِ `<end>`/`<fin>` با زمانِ ۰ می‌فرستد ⇒ پایانِ همه‌ی نوبت‌ها برابرِ offset و «end» به‌عنوانِ واژه شمرده می‌شد. در مرورگر و سرور فیلتر شدند؛ اجرایِ دوم: ۰ توکنِ کنترلی، زمان‌هایِ نوبت درست.
- `finish()` می‌توانست رویِ fetchی که هرگز settle نمی‌شود (T31 در harness) منتظر بماند ⇒ سقفِ سخت برایِ هر ارسال و برایِ کلِ flushِ پایانی (LAW-012).
- `audio-status` بعد از ویرایشِ اسکریپتی فیلدِ `transcript_quality` را نداشت (جایگزینیِ بی‌صدا) ⇒ با E2E پیدا و اضافه شد.

## ۳. تست‌هایِ خودکار (بدونِ DB/شبکه)
| دستور | نتیجه |
|---|---|
| `pnpm test:rt` | **116 PASS / 0 FAIL** (T69 رکوردِ realtime، T59 FIXED، T70 flagِ خام؛ T39 پیش‌فرضِ پردازش‌شده بدونِ تغییر). زمانِ اجرا ≈ ۴٫۷ دقیقه — **از قبل همین بود** (HEAD `a8e4411`: ۴:۳۰، ۱۱۴ PASS؛ اندازه‌گیریِ 2026-10-04)، ناشی از sleepهایِ بلندِ تست‌هایِ قدیمی، نه رکوردِ realtime |
| `pnpm test:up` | 75 PASS / 0 FAIL (H71–H74 جدید) |
| `pnpm test:hist` | 14 pass / 0 fail (H12–H14 حذفِ هم‌پوشانی) |
| `pnpm test:eval` | 8 PASS / 0 FAIL (E1–E8) |
| `test:ft` 71/0، `test:cf` 115/0، `test:tu` 19/0، `test:llm` 22/0، `test:adm` 9/0 | سبز |
| `test:arch` (171 فایل، بدونِ چرخه)، `test:routes` (183 route؛ فقط `rt-tokens` افزوده)، `test:docs`، `tsc` | سبز |

## ۴. E2Eِ backend (app.inject، DBِ dev، canary) — 18 PASS / 0 FAIL
migrationهایِ 045/046 اعمال؛ ساختِ جلسه‌ی زنده؛ تکه + retryِ idempotent؛ 400 `run-invalid`؛ 404 برایِ تراپیستِ دیگر؛ پایان ⇒ گذرِ `realtime` (`soniox-rt`، `covers_full=0`، `meta.complete=true`)؛ نوبت‌ها به ترتیبِ گوینده؛ پرونده‌ی AI همچنان `sessions.transcript`؛ GET نقش: `display`، حدسِ درمانگر=گوینده‌ی اول، چیزی ذخیره نشده؛ تأیید ⇒ `roles_complete`؛ `transcript_quality` با پوششِ اندازه‌گیری‌شده (صدایِ آرشیوِ ffmpeg)؛ ردیفِ «زنده» در نمایِ کیفیتِ ادمین؛ تکه‌ی دیررس ⇒ گذرِ تازه (قبلی می‌ماند)، `runs=2`، پوشش null، «بخشِ ۲» در نمایش؛ جلسه‌ی دستی ⇒ 409 `not-live`. پاکسازی: `left={t:0,c:0,r:0}`.

## ۵. E2Eِ مرورگرِ واقعی (Chrome headless + میکروفونِ جعلی + Sonioxِ واقعی + سرورِ :3100) — دو اجرا
با `feelia_durable_raw=1` (مسیرِ A/B هم در Chromeِ واقعی). اجرایِ دوم (پس از فیلترِ توکنِ کنترلی، ۶۰ث):
- ۱۳ تکه، ۳۱۴ توکن، همه 200، تکه‌ی پایانی `reliable`؛ جلسه `realtime_reliable=1`.
- گذرِ realtime: `meta={runs:1, chunks:13, missing:0, dropped:0, complete:true}`؛ نوبت‌ها با زمانِ درست (مثلاً ۲۹۰۵→۴۶۴۵ms)؛ **۰ توکنِ کنترلی**.
- سنجه: پوشش ۹۶٫۵٪، کم‌اطمینان ۱٪، گوینده ۳ از ۲ ⇒ پرچمِ `speakers_extra` (Soniox دو صدایِ TTS را سه گوینده شناخت — صادقانه گزارش شد).
- UI: نوارِ نقش با «گوینده ۱/۲/۳ (سهمِ کلمات)» (بدونِ حدس چون ۳ گوینده)؛ خطِ وضعیت «صدایِ جلسه ذخیره شده است (۱ دقیقه) · پوششِ متن ۹۷٪، گوینده‌هایِ بیشتری از حاضرین تشخیص داده شد»؛ تأییدِ نقش از UI ⇒ `therapist,client,other` در DB و نوار بسته شد؛ ۰ خطایِ console.
- رویدادهایِ obs: `rt.durable_raw`(ok)، `session_record.realtime_saved`، `session_record.metrics`.
- پاکسازی: canary و ۲ پوشه‌ی صدا حذف؛ فایلِ توکن پاک؛ Chrome بسته.

## ۶. انجام‌نشده / محدودیت‌ها
- **مجموعه‌ی طلایی (قدمِ ۶) و مقایسه‌ی A/B (قدمِ ۷)** نیازمندِ جلساتِ نقش‌آفرینیِ انسانی است؛ ابزار و flag آماده‌اند، عددِ واقعی هنوز نیست.
- `CANONICAL_PASS` و متنِ رضایت بیرونِ پلن (تصمیمِ مالک).
- R17 (logout در ضبطِ محلی) دست نخورد (بیرونِ پلن؛ فقط ثبت شد).
- `test:api` اجرا نشد.

## ۷. دورِ دوم — «موارد باقی‌مانده» (همان روز، به دستورِ مالک: «الان چه مواردی باقی موندن برای بهبودی انجامشون بده»)
| مورد | نتیجه |
|---|---|
| **R17** (خروج در ضبطِ محلی) | `hasActiveRecording()`ِ `index.html` + `FeeliaRT.hasActiveRecording()`. **Chromeِ واقعی** با `Network.setBlockedURLs(*realtime-session*)` ⇒ ضبطِ محلی (`wsOpen:false`, `localRecordingActive:true`) ⇒ `logout()` مسدود با بنرِ «ابتدا جلسه‌ی زنده را پایان دهید یا لغو کنید.» و صفحه همان `screenLive`؛ پس از پایانِ جلسه ضبط خاموش. |
| **export v4** | `final_transcript` (stage/source/clean_text/clean_turns/نسخه‌ها، بدونِ polish_report) + منشأ/کیفیتِ `canonical` (engine/model/meta/metrics). E2E رویِ DBِ dev با canaryِ ادمین: **5 PASS / 0 FAIL** (export تک‌تراپیست، export کل با `schema_version:4`، 403 برایِ غیرادمین). |
| **نگهبانِ رویدادِ obs** | `test:rt` **117 PASS / 0 FAIL**؛ T71 (۲۷ رویداد، ۰ بیرون از allowlist): هر `obsEvent`/`FeeliaObs.event` در `feelia-rt.js`/`index.html` باید در `OBS_CLIENT_EVENTS` باشد. |
| اعدادِ کهنه | CLAUDE.md و Master Reference: ۲۸ جدول، migration تا 046. |
| کندیِ `test:rt` | بررسی شد: **از پیش موجود** (HEAD ۴:۳۰)؛ تغییری لازم نبود (override آزموده و برگردانده شد). |

پاکسازی: canaryها (ادمین/تراپیست/مراجع) و اسکریپت‌هایِ موقت حذف؛ `left=0`.
**FINDING:** نشستِ دیگری هم‌زمان رویِ `final-transcript` (`boundaryJudge.ts`، `polishTranscript.ts`، `runner.ts`) کار می‌کرد؛ یک بار `tsc` وسطِ کارِ آن نشست خطا داد (`boundaryJudge` در `PolishConfig`) و چند دقیقه بعد سبز شد. دست زده نشد.
