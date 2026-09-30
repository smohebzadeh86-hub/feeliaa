# Module 04 — Transcription · PRD

> **وضعیت:** ACTIVE-CANONICAL · REQ-040…054 · جزئیاتِ فنی: [subsystem 01](../../07-subsystems/01-browser-realtime-engine.md)، [02](../../07-subsystems/02-audio-durability-batch-fallback.md)، [03](../../07-subsystems/03-transcript-integrity.md)، [04](../../07-subsystems/04-legacy-ws-proxy-p1.md)، [05](../../07-subsystems/05-session-audio-archive-speaker-resolve.md).

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../../02-reference/feature-index.md) (`transcription`) · قالب: [feature-doc-template](../../00-governance/feature-doc-template.md) (LAW-026)

### چرا — تصمیم‌هایِ ثبت‌شده
- (LAW-012) fail-open: شکستِ Soniox/mint/شبکه شروعِ جلسه را بلاک نمی‌کند؛ ضبطِ durable + batch بعدی.
- (2026-09-14) `pause()/resume()` WS را نمی‌بندند (keepalive طبقِ مستنداتِ Soniox) ⇒ شماره‌گذاریِ گوینده ریست نمی‌شود.
- (audit صدا، 2026-09-16) چرخشِ durable ۱۵ثانیه‌ای (کاهشِ پنجره‌ی صدایِ در-RAM)؛ (2026-09-26) آزمایشِ خاموش‌کردنِ NS/AGC/EC اثری بر تفکیکِ گوینده نداشت.
- نتیجه‌ی batch فقط append/پرکردنِ placeholder است (LAW-008، A2 2026-09-26).
- جزئیات و race‌هایِ رفع‌شده: [subsystem 01](../../07-subsystems/01-browser-realtime-engine.md)، [02](../../07-subsystems/02-audio-durability-batch-fallback.md)، [03](../../07-subsystems/03-transcript-integrity.md).

### مرزها
- `features/transcription/index.ts` API عمومیِ batch/archive/soniox/speakerResolve را می‌دهد؛ routeِ `stt.routes.ts` مستقیم از `app.ts` (R3). `legacy-ws` featureِ جدا است (LEGACY).
- مصرف‌کننده‌هایِ بیرونی: `audio-upload` (`transcribeFileAsync`…)، `final-transcript`، `admin` (آرشیو)، `session-media`.

### کد
- Backend: `features/transcription/{stt.routes,speakerResolve,signMarkers}.ts`، `soniox/{tempKey,restClient,config}.ts`، `batch/*`، `archive/*`. Frontend: `public/feelia-rt.js` (`RTSession`، `AudioQueueDB`)؛ در `index.html`: `startNewRTSession`، `rtOnState`، `endNewRTSession` ([frontend-map](../../02-reference/frontend-map.md)).

### داده
- مالک: `session_audio`. می‌نویسد: `sessions.transcript/stt_mode/batch_status`، `session_notes` (batch note)، فایل‌هایِ `data/batch-queue` و `data/session-audio`. IndexedDB `feelia-audio`.

### تست
- `pnpm test:rt` (`scripts/rt-harness.cjs`، بدونِ شبکه/DB) — موتورِ realtime/durable؛ E2Eِ مرورگرِ واقعی با Soniox در verificationهایِ تاریخ‌دار؛ `test:api` مسیرهایِ HTTP.

### ریسک و بدهی
- یتیم‌شدنِ صدا/متن در مسیرِ legacy؛ نبودِ تست برایِ batch با DBِ واقعی به‌صورتِ خودکار؛ محدودیت‌هایِ Soniox در تفکیکِ چندگوینده (شماره‌ی گوینده در هر اتصال از صفر).

## Problem
تراپیست نمی‌تواند حینِ جلسه یادداشت‌برداریِ کامل کند؛ رونویسیِ فارسیِ چندگوینده باید دقیق، ماندگار و بدونِ جعل/تکرار باشد، حتی روی اینترنتِ ناپایدار.

## Goal
متنِ کامل و قابلِ‌اعتمادِ جلسه با برچسبِ گوینده؛ نمایشِ زنده‌ی اختیاری؛ جبرانِ خودکارِ قطعی؛ امکانِ یکدست‌کردنِ گوینده‌ها پس از جلسه.

## Users / Actors
تراپیست؛ Soniox (realtime و async)؛ سرورِ Feelia (mint، batch)؛ ffmpeg.

## Use Cases
| UC | شرح |
|---|---|
| UC-04.1 | رونویسیِ زنده حینِ جلسه با نمایشِ اختیاریِ متن |
| UC-04.2 | قطعی/بازگشتِ اتصال بدونِ از دست رفتنِ متنِ تأییدشده |
| UC-04.3 | شروعِ جلسه وقتی سرویس در دسترس نیست → ضبط و رونویسی پس از پایان |
| UC-04.4 | پایانِ جلسه با اتصالِ ناقص → «متنِ نهایی هنوز آماده نیست» → اطلاع پس از آماده‌شدن |
| UC-04.5 | بازسازیِ شماره‌گذاریِ گوینده‌ها از صدای آرشیو با پیش‌نمایش و تأیید |
| UC-04.6 | ادامه‌ی رونویسی پس از رفرش از همان متن |

## Business Rules
REQ-040…054؛ LAW-003، LAW-008، LAW-012. مهم‌ترین‌ها:
- کلیدِ اصلی هرگز در مرورگر.
- متنِ confirmed هرگز کوتاه‌تر/جایگزین نمی‌شود؛ batch فقط append.
- هر ناپیوستگی علامت‌گذاری می‌شود؛ گوینده‌ها بینِ اتصال‌ها ادغام نمی‌شوند (نسبت‌دادنِ اشتباهِ گفته در یادداشتِ درمانی خطرناک است).
- بازسازیِ گوینده فقط با کلیکِ صریح (هزینه + زمان).

## Functional Requirements
1. mint per connection؛ rate-limit ۳۰/دقیقه.
2. پیکربندیِ ثابتِ مدل و diarization ([integration-architecture](../../01-architecture/integration-architecture.md)).
3. reconnect ۴ مرحله‌ای؛ NETWORK_PAUSED روی offline.
4. autosave ۵ ثانیه‌ای با CAS و rebase.
5. ضبطِ durable موازی و fallbackِ async.
6. finish مبتنی بر رویداد با timeoutِ ۸s؛ non-blocking نسبت به batch.
7. پاکسازیِ مارکرهای Soniox.
8. resolve-speakers برای جلسه‌ی completed دارای صدای آرشیو.

## Non-Functional Requirements
- از 2026-09-14 سرعتِ finalizeِ کپشن بر دقتِ diarization مقدم شد (`enable_endpoint_detection:true`)؛ یکدست‌سازیِ گوینده‌ها با resolve-speakers.
- abort امن از هر حالت.
- هیچ fetch بدونِ timeout (12s).
- هیچ صدا/متن در analytics.

## Permissions
mint و batch فقط برای جلسه‌ی مالک؛ mint و آپلودِ transcript/note فقط برای جلسه‌ی پایان‌نیافته.

## States
[subsystem 01 §2](../../07-subsystems/01-browser-realtime-engine.md)؛ `batch_status`/`stt_mode`/`realtime_reliable` در [database-catalog](../../02-reference/database-catalog.md).

## Validation
حجمِ صدا ۱۰۰B–۵۰MB (سقفِ عملی 1MiB)؛ `purpose` ∈ سه مقدار (پیش‌فرض transcript)؛ `seq` عددِ ≥0.

## Dependencies
Soniox، `PROXY_URL`، ffmpeg، IndexedDB، ماژول 03، ماژول 06 (پخشِ آرشیو).

## Acceptance Criteria
- [ ] هیچ درخواستی از مرورگر شاملِ کلیدِ اصلی نیست (T1).
- [ ] قطعِ WS وسطِ interim: confirmed حفظ، interim پاک، mint تازه (T2).
- [ ] mint همیشه 503: جلسه usable، ضبطِ durable، batch پس از پایان (T16) — **در WT FAIL**.
- [ ] 409 → متنِ طولانی‌تر حفظ (T10).
- [ ] finish با batchِ معلق < 3s برمی‌گردد (T14).
- [ ] resolve-speakers روی جلسه‌ی in_progress → 400.

## Known Contradictions / Gaps
C1 (رضایت ↔ آرشیو)، C7 (harness)، سقفِ 1MiB، CAS غیراتمیک.

## آپلودِ فایلِ صوتیِ جلسه (2026-09-23)
مسیرِ سوم در کنارِ رونویسیِ زنده و batch fallback: فایلِ ضبط‌شده (مثلاً با گوشی وقتی اینترنتِ کلینیک ضعیف بود) آپلود و در پس‌زمینه با `stt-async-v5` و تفکیکِ گوینده رونویسی می‌شود — REQ-055…059. مالکِ جزئیات: [subsystem 06](../../07-subsystems/06-audio-upload-pipeline.md).

## Out of Scope
ترجمه، خلاصه، تشخیصِ هویتِ گوینده (نام‌گذاری)، ویرایشِ دستیِ متن در UI، زبان‌های غیرِ فارسی به‌عنوانِ hint.
