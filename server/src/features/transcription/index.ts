// APIِ عمومیِ feature رونویسی برایِ featureهایِ دیگر و jobها (routeها از stt.routes.ts مستقیم در app.ts ثبت می‌شوند).
// صفِ batch (fallbackِ رونویسی رویِ سرور)
export { enqueueBatch, processBatchQueue, retryQueuedBatches } from './batch/processQueue.js';
export { pendingAudioFor, pendingAudiosFor, validateAudioBuffer, type BatchPurpose } from './batch/queueFiles.js';
export { sweepOldBatchFiles, BATCH_SWEEP_INTERVAL_MS } from './batch/sweep.js';
// آرشیوِ صدایِ جلسات (فقط ادمین)
export { archiveAudioFileForAdmin } from './archive/archiveWrite.js';
export { listSessionAudio, getSessionAudioRow, deriveSessionStatus, checkSeqContiguous } from './archive/listing.js';
export { listSkips, recordSkippedSegments, parseEmptySeqs, type SkipRow } from './archive/skips.js';
export { getFullSessionAudio } from './archive/fullAudio.js';
export { deleteSessionAudioDirs, sweepOldSessionAudio } from './archive/sweep.js';
export { SESSION_AUDIO_RETENTION_MS, type SessionAudioRow } from './archive/store.js';
// بازسازیِ اختیاریِ گوینده‌ها
export { getResolveJob, startResolveSpeakers, sweepOldResolveJobs } from './speakerResolve.js';
// کلاینتِ RESTِ Soniox (رونویسیِ async)
export {
  transcribeFileAsync, uploadFileFromPath, createTranscription, pollTranscriptionStatus, getTranscriptTokens,
  buildTextFromAsyncTokens, deleteTranscription, deleteFile, listSonioxFiles, listSonioxTranscriptions,
  lowConfidenceRatio, markedTextFromTokens, lowConfidenceWarnRatio,
} from './soniox/restClient.js';
// نشانگرِ علائم در متن
export type { SignMark } from './signMarkers.js';
