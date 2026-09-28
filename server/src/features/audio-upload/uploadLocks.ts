import { createKeyedLock } from '../../shared/keyedLock.js';

// قفلِ درون‌پروسه‌ای (تک‌پروسه — LAW-013): کلیدِ <uploadId> برایِ complete (دو کلیک/دو تبِ هم‌زمان دو بار الحاق
// نمی‌کنند) و کلیدِ 'group:<groupId>' برایِ عملیاتِ یک آپلودِ چندبخشی (finalize/لغو). یک instance برایِ هر دو.
export const withUploadLock = createKeyedLock();
