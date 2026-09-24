# Subsystem 04 — Legacy WS Proxy (P1) و SonioxDirect

> **وضعیت:** ACTIVE-CANONICAL برای کدِ **LEGACY** · قانون: LAW-015 (frozen — فقط bugfix) · کد: `server/src/ws/transcription.ts`، `server/src/ws/p1.ts`، `server/src/stt/soniox.ts`، و در `public/index.html`: `SonioxDirect`، `startDirectLive`، `fallbackToProxy`، `endDirectLive`، `connectWS`، `attemptWSReconnect`، `startMic`، `p1ReplayUnacked`، `handleMsg`، `pauseSessionLive`/`resumeSessionLive`، `startVoiceNote` (شاخه‌ی `/ws/voice`).

## ۱. کی اجرا می‌شود؟
فقط اگر `FeeliaRT` در دسترس نباشد یا `start()` آن false برگرداند (عملاً: مرورگرِ بدونِ MediaRecorder/WebSocket/getUserMedia، یا خطای میکروفون). ترتیب: `SonioxDirect` (مگر `localStorage.feelia_direct==='0'`) → در هر خطا `fallbackToProxy` → `/ws/t`. پیامد: در استفاده‌ی عادی این کد اجرا نمی‌شود و **تست ندارد**.

## ۲. `/ws/t/:sessionId` — معماری (از سربرگِ کد)
«DB status ≠ connectionState ≠ Engine generation ≠ chunk identity ≠ transcript confirmation»؛ Transcript Integrity سخت، Audio Continuity best-effort.

- هر اتصال = `generation+1`، `resetOrdering` (seq از ۱)، abortِ موتورِ نسلِ قبل.
- `earlyQueue` (۵۱۲ پیام) برای پیام‌های قبل از آماده‌شدنِ موتور.
- **Ordering:** `chunk-meta{seq}` قبل از هر blob؛ `nextExpected`؛ reorder buffer (۱۰۰)؛ timeoutِ head-gap ۲s (در handover ۵s) → skip؛ overflow → skipِ اجباری.
- **ACK** = تحویل به socketِ باز Soniox (نه durable)؛ کلاینت `unacked` را replay می‌کند.
- **Pause/Resume:** `pauseEpoch`، `resumeArmed` (بافرِ chunkهای پنجره‌ی setup)؛ resume موتورِ تازه با prefixِ DB می‌سازد.
- **Interruption:** بستنِ socket بدونِ terminal → grace ۶۰s → `UPDATE status='recovered' WHERE status='in_progress'`.
- **Finalize:** drain → `engine.stop()` → `onFinished` → `status='completed'`.
- **Cancel:** `status='canceled'`.
- **close-hint:** مسیرِ سریعِ interruption.
- نوشتنِ متن: `UPDATE sessions SET transcript` روی هر preview با guardِ طولِ یکنواخت — **بدونِ transcript_version** (W4 در [subsystem 03](03-transcript-integrity.md)).

## ۳. `/ws/voice/:sessionId`
`SonioxEngine` ساده؛ باینری → Soniox؛ `finalize` → `stop` → متنِ غیرخالی → `session_notes(voice)`. بستنِ socket → `stop`.

## ۴. `SonioxEngine` (سرور)
WS با `ws`، `PROXY_URL`، reconnect تا ۶ بار با backoff نمایی، بافرِ ۲۰۰ chunk، `stop()` با resolverهای ثبت‌شده (fix `7f7a80c`)، `abort()` بدونِ finalize، `prefix` برای ادامه‌ی متن، حذفِ `<end>/<fin>` (fix `17dd11a`). استفاده‌ی غیرِ legacy: ~~probe در `GET /api/stt/check`~~ — حذف شد 2026-09-24 (هر بار «No audio received» در لاگ می‌ساخت؛ [verification](../../verification/2026-09-24-stt-check-no-audio-log.md)).

## ۵. `SonioxDirect` (فرانت)
نسخه‌ی اولیه‌ی اتصالِ مستقیم (قبل از FeeliaRT): mint → WS با `enable_endpoint_detection:true` (از 2026-09-14 با مسیرِ اصلی یکسان است؛ C6 بسته شد) → فقط یک اتصال، هر خطا/close → proxy. متن هر ۱۰s با `saveDirectTranscript` (PUT بدونِ نسخه) ذخیره می‌شود. ابزارهای دستیِ کنسول: `SonioxDirect.quickTest(id)`، `liveTest(id, s)`.

## ۶. endpointِ HTTP legacy
`POST /api/sessions/:id/voice-note` — در فرانت مصرف‌کننده ندارد؛ رونویسیِ async در پس‌زمینه. به‌علتِ سقفِ 1MiB، ادعای «تا 50MB» عملاً درست نیست.

## ۷. قواعدِ تغییر
- فیچرِ جدید اینجا ممنوع؛ bugfix با حداقلِ تغییر.
- هر تغییر در `feelia-rt.js` که `isAvailable`/`start` را false کند این مسیر را فعال می‌کند — آگاه باشید.
- حذفِ این مسیرها: تصمیمِ مالک؛ پیشنهاد در [master plan](../05-plans/master-implementation-plan.md) (P3).
