// نقطه‌ی ورودِ عمومیِ ماژولِ «متنِ نهایی» — بقیه‌ی سیستم فقط از این فایل import می‌کند.
export { enqueueFinalTranscript, startFinalTranscriptWorker, wakeFinalTranscriptWorker } from './runner.js';
export { finalTranscriptRoutes } from './api/finalTranscript.routes.js';
export { appendUploadForPolish } from './domain/transcriptText.js';
