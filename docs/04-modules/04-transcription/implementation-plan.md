# Module 04 — Transcription · Implementation Plan

## Current State
- مسیرِ اصلیِ Browser→Soniox از `f9b0a9c` در git؛ صفِ IndexedDB، آرشیو، async batch، resolve-speakers، discontinuity marker — همه commit شده (`2763414`، 2026-09-14). امروز (`54a17fd`) فقط یک لاگِ تشخیصیِ کوچک به `feelia-rt.js` اضافه شد (دلیلِ واقعیِ شکستِ mint/اتصال حالا لاگ می‌شود).
- harness (working tree = HEAD، دیگر واگرایی ندارند): **۲۹ PASS / ۶ FAIL** — baselineِ پایدار، بدونِ ربط به تغییراتِ اخیر ([verification 2026-09-15](../../../verification/2026-09-15-clients-tabs-ui.md)).
- typecheck سرور تمیز.

## Code Anchors
| لایه | anchor |
|---|---|
| mint | `server/src/http/stt.ts` (`mintRateLimited`، `STT_DEFAULTS`، `/api/stt/realtime-session`، `/api/stt/check`)، `server/src/stt/tempkey.ts#mintTemporaryKey` |
| engine | `public/feelia-rt.js` (`RTSession`، `AudioQueueDB`، `reqJson`) |
| batch | `server/src/http/sessions.ts` (batch-audio/status/retry)، `server/src/stt/batchqueue.ts`، `server/src/stt/asyncTranscribe.ts` |
| CAS | `server/src/http/sessions.ts` PUT |
| resolve | `server/src/stt/speakerResolve.ts`، `sessions.ts` resolve-speakers، `index.html` `startResolveSpeakersUI`/`applyResolvedSpeakers` |
| archive | `server/src/stt/sessionAudioArchive.ts` |
| legacy | `server/src/ws/*`، `server/src/stt/soniox.ts`، `index.html` `SonioxDirect`/`connectWS` |
| glue | `index.html` `startNewRTSession`، `rtOnState`، `endNewRTSession`، `sweepOrphanedAudioQueue` |
| test | `scripts/rt-harness.cjs` |

## Architecture Impact
T-3 و T-4 رفتارِ هم‌زمانی را سخت‌تر می‌کنند؛ مرزها تغییر نمی‌کنند.

## Data / Schema Changes
ندارد.

## Backend Changes (Proposed)
| # | تغییر | REQ | ریسک |
|---|---|---|---|
| T-3 | CAS اتمیک: `UPDATE sessions SET … WHERE id=$1 AND transcript_version=$2 … RETURNING`؛ 0 ردیف → بررسیِ وجود → 404 یا 409 | REQ-045 | پایین |
| T-4 | قفلِ per-session در حافظه برای `processBatchQueue` (Set/Map از sessionId:purpose) تا دو پردازشِ هم‌زمان رخ ندهد | REQ-046 | پایین؛ single-instance |
| T-5 | worker/retryِ دوره‌ای برای فایل‌های مانده در `batch-queue` قبل از انقضای ۲۴h | REQ-046، REQ-091 | متوسط (هزینه‌ی Soniox) |
| T-6 | `buildTextFromAsyncTokens` مارکرهای `<end>/<fin>` را هم پاک کند (در صورتِ تأییدِ وجود) | REQ-049 | پایین |
| T-7 | سقفِ multipart | REQ-100 (platform PL-2) | پایین |

## Frontend Changes (Proposed)
| # | تغییر | REQ |
|---|---|---|
| T-1 | stubِ `indexedDB` در harness (یا تزریقِ `AudioQueueDB` قابلِ‌جایگزینی) تا T2/T15/T16 دوباره سبز شوند | R6 |
| T-2 | پیامِ درستِ `onError` وقتی IndexedDB در دسترس نیست (نه «فضا پر شده») | REQ-097 |
| T-8 | رفتارِ آرشیو مطابقِ تصمیمِ P0-1 (`archiveQueuedAudioOnly`، `drainQueuedAudioInBackground` purpose=archive، `sweepOrphanedAudioQueue`) | REQ-098 |
| T-9 | seqِ durable پایدار بینِ `RTSession`های یک جلسه (مثلاً شروع از `max(seq)+1` در IndexedDB/سرور) برای جلوگیری از بازنویسیِ آرشیو | subsystem 05 §2.2 |

## API Changes
T-3: بدونِ تغییرِ قرارداد. T-8 ممکن است `purpose=archive` را حذف کند → api-catalog.

## Integration Changes
T-5 مصرفِ Soniox را افزایش می‌دهد.

## Migration Strategy
ندارد.

## Testing Strategy
1. baseline: `pnpm test:rt` قبل از هر تغییر (خروجی ذخیره).
2. T-1 اول، تا پوششِ fallback برگردد.
3. سناریوهای جدید: دو آپلودِ هم‌زمان (T-4)، دو PUT هم‌زمان (T-3، تستِ backend)، seq پس از reload (T-9).
4. `npx tsc --noEmit`.

## Deployment Strategy
T-8 همراه با تغییرِ متنِ رضایت (ماژول 03 S-8). T-4/T-3 مستقل.

## Risks
- T-8 (ب) resolve-speakers را برای جلساتِ موفق غیرفعال می‌کند.
- هر تغییر در `start()` که false برگرداند مسیرهای legacy را فعال می‌کند.

## Rollback Strategy
revert؛ صفِ IndexedDB سازگار با عقب است (همان schema v1).

## Verification Checklist
- [ ] harness 35/35 در WT پس از T-1
- [ ] هیچ duplicate در سناریوی pause/resume و reconnect (T2، T6)
- [ ] جلسه‌ی آزمایشیِ واقعی (داده‌ی غیرواقعی) روی staging/dev با قطعِ عمدیِ شبکه
- [ ] لاگ‌ها بدونِ متن (LAW-001)

## Documentation Updates
subsystems 01/02/03/05، api-catalog، configuration-catalog، traceability-matrix، verification/ (فایلِ جدید).
