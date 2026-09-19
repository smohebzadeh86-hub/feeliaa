# Integration Architecture

> **وضعیت:** ACTIVE-CANONICAL · منابع: `server/src/stt/*`، `public/feelia-rt.js`، `public/feelia-analytics.js`، `server/src/http/clientConfig.ts`.

## ۱. فهرستِ یکپارچه‌سازی‌ها

| سیستم | جهت | پروتکل | از کجا | احراز | حساسیت داده | در صورتِ خرابی |
|---|---|---|---|---|---|---|
| Soniox Realtime `wss://stt-rt.soniox.com/transcribe-websocket` | Browser → | WebSocket | `feelia-rt.js` (`openDirectWS`) | temp key در پیامِ اول | صدای زنده + متن | reconnect → FAILED → durable/batch |
| Soniox Temp Key `POST {SONIOX_API_BASE}/v1/auth/temporary-api-key` | Server → | HTTPS | `stt/tempkey.ts` | `Bearer SONIOX_API_KEY` | شناسه‌ی `feelia:<therapistId>:<sessionId>` | 503/502 → کلاینت durable-only |
| Soniox Files/Transcriptions (`/v1/files`, `/v1/transcriptions`) | Server → | HTTPS | `stt/asyncTranscribe.ts` | Bearer master | فایلِ صدا | فایل در صف می‌ماند؛ `batch_status=queued` |
| Soniox Realtime (سمتِ سرور) | Server → | WebSocket (`ws`) | `stt/soniox.ts` | master key در پیامِ اول | صدا | فقط legacy و probeِ `/api/stt/check` |
| Microsoft Clarity `https://www.clarity.ms/tag/<id>` | Browser → | script + collect | `feelia-analytics.js` | Project ID عمومی | رفتارِ UI (masked) | خاموشیِ بی‌صدا |
| Google Fonts (Vazirmatn) | Browser → | CSS/فونت | `index.html` `<link>` | — | IP کاربر | fallback فونت |
| ffmpeg | Server (پروسه‌ی محلی) | `execFile` | `stt/speakerResolve.ts` | — | صدا | resolve-speakers خطا |
| PostgreSQL | Server → | TCP | `db/connection.ts` | `DATABASE_URL` | همه | health=degraded؛ startup fail |

## ۲. Soniox — جزئیاتِ قرارداد

### 2.1 کلیدِ موقت
- پارامترها (`stt/tempkey.ts`): `usage_type:"transcribe_websocket"`، `expires_in_seconds:120`، `single_use:true`، `max_session_duration_seconds:7200`، `client_reference_id`.
- timeoutِ mint: ۱۰ ثانیه. خطاها → `TempKeyError` با `code` ∈ `no-key | mint-transport | mint-timeout | mint-rejected`.
- سرور rate-limit: ۳۰ mint/دقیقه برای هر تراپیست (in-memory).
- هر اتصالِ جدید (شروع، reconnect، resume) mint تازه می‌گیرد. خطای `temp_api_key_session_expired` از Soniox → reconnect با mint جدید.

### 2.2 پیکربندیِ realtime (هر سه مسیرِ اصلی/سرور)
```json
{ "model": "stt-rt-v5", "audio_format": "auto", "language_hints": ["fa"],
  "enable_language_identification": true, "enable_speaker_diarization": true,
  "enable_endpoint_detection": true }
```
**به‌روزشده 2026-09-14:** `enable_endpoint_detection` در همه‌ی مسیرها (`feelia-rt.js`، `STT_DEFAULTS` در `http/stt.ts`، `stt/soniox.ts`، و `SonioxDirect` در `index.html`) `true` است — هم در working tree و هم در production (`8bcdf0e`). طبقِ Event Log، نشستِ دیگری آن را پس از گزارشِ کندیِ finalize توسطِ کاربر از `false` به `true` برگرداند (معاوضه‌ی سرعتِ کپشن در برابرِ دقتِ diarization). تعارضِ C6 دیگر وجود ندارد.
صدا: `MediaRecorder` با mime از `audio/webm;codecs=opus` → `audio/webm` → `audio/ogg;codecs=opus` → `audio/ogg`، `timeslice=250ms`. پایان: `{"type":"finalize"}` سپس رشته‌ی خالی.
توقفِ دستی (FeeliaRT، از 2026-09-14): `{"type":"finalize"}` بدونِ رشته‌ی خالی، سپس `{"type":"keepalive"}` هر ۵s تا ادامه یا پایان؛ اتصال باز می‌ماند.

### 2.3 پردازشِ توکن
- `is_final` → append به confirmed؛ non-final → interim (هر پیام reset).
- شماره‌ی گوینده: کلید `generation:rawSpeaker` → برچسبِ سراسری (`گوینده ۰`، …) — subsystem 01.
- حذفِ `<end>`، `</end>`، `<fin>` از متن (`cleanText` / `buildTextFromTokens`).

### 2.4 async (fallback، یادداشت، resolve)
`uploadFile` (multipart، انتظارِ 201) → `createTranscription` (`stt-async-v5`، `fa`، diarization، language id) → poll هر ۲s تا ۱۰ دقیقه → `GET …/transcript` → `buildTextFromAsyncTokens` → `finally`: حذفِ transcription و فایل در Soniox.
توجه: `buildTextFromAsyncTokens` مارکرهای `<end>/<fin>` را حذف نمی‌کند (برخلافِ نسخه‌ی realtime) — اینکه async چنین مارکری برمی‌گرداند یا نه **UNVERIFIED**.

### 2.5 egress
`PROXY_URL` (اختیاری) → `HttpsProxyAgent` برای mint، async، و WSِ سمتِ سرور. مرورگر از آن استفاده نمی‌کند. `SONIOX_WS_URL` و `SONIOX_API_BASE` قابلِ override هستند (مثلاً منطقه‌ی EU؛ `diag-collect.sh` endpoint `stt-rt.eu.soniox.com` را هم تست می‌کند).

## ۳. Clarity
جریان و قواعد: [ماژول 07](../04-modules/07-ux-analytics/module-prd.md) و [`docs/analytics-clarity.md`](../analytics-clarity.md) (مالک). خلاصه‌ی integration: `GET /api/client-config` → `{clarity:{projectId}|null}` (برای ادمین همیشه null) → با رضایت، تزریقِ یک `<script async>`.

## ۴. پیامدهای حریمِ خصوصی

| جریان | چه داده‌ای خارج می‌شود | کنترل |
|---|---|---|
| Browser→Soniox RT | صدای کاملِ جلسه | رضایتِ مراجع؛ temp key |
| Server→Soniox async | صدای سگمنت‌ها/کلِ جلسه (resolve) | حذف در `finally` |
| Browser→Clarity | رفتارِ UI بدونِ متن | mask + consent + allowlist |
| Browser→Google Fonts | IP/UA | — (هیچ کنترلی؛ ثبت برای بررسیِ آینده) |
