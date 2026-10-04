// نقطه‌ی ورودِ عمومیِ ماژولِ «متنِ نهایی» — بقیه‌ی سیستم فقط از این فایل import می‌کند.
export { enqueueFinalTranscript, startFinalTranscriptWorker, wakeFinalTranscriptWorker } from './runner.js';
export { finalTranscriptRoutes } from './api/finalTranscript.routes.js';
export { appendUploadForPolish } from './domain/transcriptText.js';
export { retryFinalTranscript } from './runner.js';
// تاریخچه‌ی فقط‌افزودنی (migration 037) — خواندن برایِ پنلِ ادمین
export { listVersions as listFinalTranscriptVersions, getVersionText as getFinalTranscriptVersion, exportFinalTranscript } from './adapters/versionStore.js';
// نقشِ هر گوینده در متنِ نهایی ⇒ پیشنهادِ نقش در رکوردِ canonical (core-data-plan قدمِ ۳؛ سیم‌کشی در app.ts)
export { finalTranscriptSpeakerRoles } from './adapters/speakerRoles.js';
