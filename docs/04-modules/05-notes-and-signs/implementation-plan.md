# Module 05 — Notes & Signs · Implementation Plan

## Current State
در HEAD موجود؛ یادداشتِ صوتیِ FeeliaRT و صفِ note در WT تغییر کرده. T15 در WT شکست می‌خورد.

## Code Anchors
| لایه | anchor |
|---|---|
| API | `server/src/http/sessions.ts`: `POST /api/sessions/:id/notes`، `DELETE /api/notes/:id`، `processVoiceNoteInBackground`، `voice-note` (legacy) |
| batch | `server/src/stt/batchqueue.ts` (`purpose==='note'`) |
| legacy WS | `server/src/ws/transcription.ts` `/ws/voice` |
| UI Live | `.sign-chip` handler، `renderSignsLog`، `removeSign`، `addQuickNote`، `renderNotesLog` |
| UI Wrapup | `renderWrapupSigns`، `renderWrapupNotesLog`، `renderWrapupNotes`، `showTextInput`، `addTextNote`، `startVoiceNote`، `startVoiceNoteDirect`، `stopVoiceNote`، `stopVoiceNoteDirect`، `cleanupVoice` |
| DB | migration 003 |

## Architecture Impact
ندارد.

## Data / Schema Changes (Proposed)
N-1 (اختیاری): CHECK روی `session_notes.type`.

## Backend Changes (Proposed)
| # | تغییر |
|---|---|
| N-2 | `offset_ms ?? null` به‌جای `||` |
| N-3 | اعتبارسنجیِ `type` |

## Frontend Changes (Proposed)
| # | تغییر |
|---|---|
| N-4 | خواندنِ کاملِ `removeSign`/`addQuickNote` و بررسیِ ماندگاریِ یادداشتِ voiceِ realtime در DB؛ رفعِ شکاف در صورتِ تأیید |

## API Changes
N-3: 400 برای type نامعتبر.

## Integration Changes
ندارد.

## Migration Strategy
N-1 پس از اطمینان از مقادیرِ موجود.

## Testing Strategy
T15 پس از stubِ IndexedDB؛ inject برای notes.

## Deployment Strategy
مستقل.

## Risks
N-1 روی داده‌ی ناسازگار startup را متوقف می‌کند.

## Rollback Strategy
revert؛ migrationِ جبرانی.

## Verification Checklist
- [ ] ثبتِ علامت در ثانیه‌ی 0 → `offset_ms=0`
- [ ] T15 سبز
- [ ] یادداشتِ صوتیِ realtime پس از «ذخیره و پایان» در `GET /api/sessions/:id` دیده می‌شود

## Documentation Updates
database-catalog، api-catalog، PRD (Known Gaps).
