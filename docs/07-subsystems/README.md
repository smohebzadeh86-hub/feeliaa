# Subsystems

> **وضعیت:** ACTIVE-CANONICAL · بخش‌هایی که از نظرِ فنی/عملیاتی پیچیده‌اند و Agent **قبل از تغییرشان** باید brief مخصوص را بخواند.

| # | Subsystem | فایل‌های اصلی | چرا پرریسک است | قوانینِ کلیدی |
|---|---|---|---|---|
| 01 | [Browser Realtime Engine](01-browser-realtime-engine.md) | `public/feelia-rt.js` | state machineِ ۱۱ حالته، race‌های async، epoch | LAW-003، LAW-008، LAW-012 |
| 02 | [Audio Durability & Batch Fallback](02-audio-durability-batch-fallback.md) | `feelia-rt.js` (AudioQueueDB)، `stt/batchqueue.ts`، `stt/asyncTranscribe.ts` | duplicate/گم‌شدنِ متن، حجمِ صدا، حریمِ خصوصی | LAW-008، LAW-009، LAW-010 |
| 03 | [Transcript Integrity](03-transcript-integrity.md) | `PUT /api/sessions/:id`، `persistConfirmed`، `mergeBatchTranscript` | از دست رفتنِ متنِ جلسه | LAW-008 |
| 04 | [Legacy WS Proxy (P1)](04-legacy-ws-proxy-p1.md) | `server/src/ws/*`، `stt/soniox.ts`، بخش‌های legacy در `index.html` | پروتکلِ ordering پیچیده؛ frozen | LAW-015 |
| 05 | [Session Audio Archive & Speaker Resolve](05-session-audio-archive-speaker-resolve.md) | `stt/sessionAudioArchive.ts`، `stt/speakerResolve.ts`، روت‌های admin | نگهداریِ صدا، تعارضِ رضایت، ffmpeg | LAW-005، LAW-009، LAW-010 |

subsystemهایی که **وجود ندارند** و ساخته نشده‌اند: پرداخت، اعلان/پیامک، جستجو، صفِ پیامِ مستقل، cache.
