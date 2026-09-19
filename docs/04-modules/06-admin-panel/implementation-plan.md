# Module 06 — Admin Panel · Implementation Plan

## Current State
پایه و export در HEAD؛ مسیرهای `clients/:id/sessions`، `sessions/:id/audio`، `session-audio/:audioId/stream` و UIِ `#screenAdminSessions` commit شده در `2763414`. بدونِ تستِ خودکار؛ رندرِ دستیِ صفحاتِ ادمین (کارتِ تراپیست، سه‌دکمه‌ی `مشاهده/دانلود/حذف`) با داده‌ی canary در [verification 2026-09-15](../../../verification/2026-09-15-clients-tabs-ui.md).

## Code Anchors
| لایه | anchor |
|---|---|
| API | `server/src/http/admin.ts`: `buildTherapistExport`، stats، therapists، therapists/:id/clients، clients/:id/sessions، sessions/:id/audio، session-audio stream، exportها، PATCH، DELETEها |
| guard | `server/src/auth/guard.ts#requireAdmin` |
| archive | `server/src/stt/sessionAudioArchive.ts` (`listSessionAudio`، `getSessionAudioRow`) |
| UI | `index.html`: `openAdminPanel`، `loadAdminStats`، `renderAdminStats`، `loadAdminTherapists`، `searchAdminTherapists`، `renderAdminTherapists`، `adminSetActive`، `adminSetIsAdmin`، `showDeleteTherapist`/`checkDeleteTherapistConfirm`/`confirmDeleteTherapist`، `openAdminTherapistDetail`، `openAdminClientSessions`، `adminDeleteClient`، `adminDownloadTherapist`، `adminDownloadAll` |

## Architecture Impact
ندارد.

## Data / Schema Changes
ندارد.

## Backend Changes (Proposed)
| # | تغییر | REQ |
|---|---|---|
| AD-1 | افزودنِ `status`، `status_reason`، `category`، `gender` (مراجع)، `specialty` (تراپیست)، `stt_mode`/`realtime_reliable` (جلسه) به export | REQ-077 |
| AD-2 | حذفِ فایل‌های صدا در حذفِ تراپیست/مراجع | REQ-093 |
| AD-3 | اعتبارسنجیِ `Range` (`start ≤ end < size`) | کیفیت |
| AD-4 | (تصمیمِ مالک) لاگِ ممیزیِ export و پخشِ صدا بدونِ داده‌ی حساس | طراحیِ v1 |
| AD-5 | (اختیاری) صفِ `last admin` برای PATCH دیگران: جلوگیری از بی‌نقش‌کردنِ آخرین ادمینِ دیگر — فعلاً فقط برای خود چک می‌شود؛ ولی چون فقط ادمین PATCH می‌کند همیشه حداقل خودش ادمین است (غیربحرانی) | — |

## Frontend Changes (Proposed)
| # | تغییر | REQ |
|---|---|---|
| AD-6 | مدالِ تأیید برای `adminDeleteClient` | REQ-075، R9 |

## API Changes
AD-1: فیلدهای بیشتر در JSONِ export.

## Integration Changes
ندارد.

## Migration Strategy
ندارد.

## Testing Strategy
inject: 401/403، قواعدِ self، cascade، Range 206، export ساختار. UI با mock backend (بدونِ حسابِ واقعی).

## Deployment Strategy
AD-2 با platform PL-3.

## Risks
AD-2 destructive؛ export شاملِ داده‌ی کامل است — دانلود روی دستگاهِ امن.

## Rollback Strategy
revert.

## Verification Checklist
- [ ] Acceptance Criteria PRD
- [ ] مدالِ تأیید قبل از حذفِ مراجع
- [ ] export شاملِ فیلدهای جدید

## Documentation Updates
api-catalog، PRD (Known Contradictions)، requirement-catalog.
