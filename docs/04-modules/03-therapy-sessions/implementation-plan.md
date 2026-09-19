# Module 03 — Therapy Sessions · Implementation Plan

## Current State
کامل؛ بنرهای ادامه، durable-only، timer در pause، resolve-speakers در پرونده — commit شده در `2763414`. ثبتِ دستیِ جلسه‌ی گذشته (`mode:"manual"`)، تاریخِ شمسیِ اختیاری (`http/sessionDate.ts`، migration 012–014)، و صفحه‌ی مستقلِ SessionDetail — commit شده در `54a17fd` (2026-09-15). `DIAG-TEMP` هنوز در `PUT /api/sessions/:id` است (R2، رفع‌نشده).

## Code Anchors
| لایه | anchor |
|---|---|
| API | `server/src/http/sessions.ts`: POST/GET/PUT/DELETE `/api/sessions`؛ `server/src/http/clients.ts`: `/api/recovered` |
| مالکیت | `db/ownership.ts#getOwnedSession` |
| DB | migrations 002، 007 |
| UI Setup | `setupNewSession`، `runPreflight`، `setConsent`، `declineConsentAndExit`، `updateStartButtonState`، `maybeShowWebViewHint`، `maybeShowHttpsHint`، `describeMicError` |
| UI Live | `startSession`، `startNewRTSession`، `rtOnState`، `pauseSessionLive`/`resumeSessionLive` (→ `rtPauseLive`/`rtResumeLive` یا legacy)، `startSttWatchdog`، `persistDuration`، timer (`startTimer`/`pauseTimer`)، `endSession` |
| UI End | `endNewRTSession`، `handleFinished`، `confirmCancelSession`، `finishSession`، `showExitWarning`، `goBackToClients`، `beforeunload` |
| UI Recovery | `checkActiveSessionBanner`، `liveResumeSession`، `showInterruptedBanner`، `resumeSession` |
| UI Review | `openClientDetail`، `viewTranscript`، `openEditSessionMeta`/`saveSessionMeta`، `showDeleteSession`/`confirmDeleteSession` |

## Architecture Impact
ندارد.

## Data / Schema Changes (Proposed)
| # | تغییر | وابسته به |
|---|---|---|
| S-1 | تصمیم درباره‌ی فرمتِ `date` (شمسی/میلادی/ISO) و migrationِ داده در صورتِ لزوم | تصمیمِ مالک (P2-3) |
| S-2 | (اختیاری) CHECK روی `sessions.status` | پس از S-3 |

## Backend Changes (Proposed)
| # | تغییر | REQ/LAW |
|---|---|---|
| S-3 | اعتبارسنجیِ `status` در PUT (`in_progress|recovered|completed|canceled`) | اعتبار |
| S-4 | حذفِ `DIAG-TEMP` | REQ-099 |
| S-5 | `/api/recovered` بدونِ `transcript` | data minimization |
| S-6 | `session_num` اتمیک (retry روی 23505) | REQ-021 |
| S-7 | حذفِ فایل‌های صدا در DELETE | REQ-093 |

## Frontend Changes (Proposed)
| # | تغییر | وابسته |
|---|---|---|
| S-8 | متنِ کارتِ رضایت و privacy note مطابقِ تصمیمِ P0-1 | P0-1 |
| S-9 | ارسالِ تاریخ از کلاینت یا نمایشِ یکسان | S-1 |
| S-10 | استفاده از `err.status===404` به‌جای زیررشته‌ی `'یافت نشد'` در `liveResumeSession` | error-code-catalog |

## API Changes
S-3: 400 برای status نامعتبر. S-5: حذفِ فیلد از پاسخ (UI فقط `session_num`، `client_code`، `client_alias`، `date`، `id` استفاده می‌کند — تأیید شود).

## Integration Changes
ندارد.

## Migration Strategy
S-1 فقط با migrationِ جدید و backup.

## Testing Strategy
harness (T6، T9، T17)؛ inject برای consent/status/مالکیت؛ تستِ UI با mock backend (میکروفون در Browser pane در دسترس نیست → مسیرِ Live فقط تا حدِ UI).

## Deployment Strategy
S-8 باید هم‌زمان با تغییراتِ صدای P0-1 منتشر شود.

## Risks
S-5 اگر جای دیگری `transcript` از `/api/recovered` بخواند می‌شکند (grep نشان داد فقط `showInterruptedBanner`).

## Rollback Strategy
revert؛ S-1 نیازمندِ migrationِ جبرانی.

## Verification Checklist
- [ ] `pnpm test:rt` بدونِ شکستِ جدید نسبت به baseline
- [ ] `npx tsc --noEmit`
- [ ] Acceptance Criteria PRD
- [ ] متنِ رضایت با [subsystem 05](../../07-subsystems/05-session-audio-archive-speaker-resolve.md) می‌خواند

## Documentation Updates
api-catalog، database-catalog، requirement-catalog (REQ-021، 029، 098)، PROJECT_MASTER_REFERENCE §22.
