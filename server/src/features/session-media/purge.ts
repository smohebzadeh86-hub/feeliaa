// دُمِ مشترکِ حذفِ آبشاریِ جلسه/مراجع/تراپیست (LAW-010): فایل‌هایِ صدایِ رویِ دیسک و منابعِ Soniox که cascadeِ DB
// نمی‌بیند. هر مسیرِ حذف چکِ مالکیت/rowCount، پیامِ 404، logEvent و ممیزیِ خودش را نگه می‌دارد و فقط این دو گام را
// صدا می‌زند:
//   const media = await prepareSessionMediaPurge(sessionIds);   ← پیش از DELETE (بعد از آن شناسه‌ها قابلِ خواندن نیستند)
//   purgeSessionMedia(media);                                   ← فقط بعد از DELETEِ موفق
import { deleteSessionAudioDirs } from '../transcription/index.js';
import { collectUploadSonioxRefs, releaseSonioxRefs, type SonioxRef } from '../audio-upload/index.js';

export interface SessionMediaPurge {
  sessionIds: string[];
  sonioxRefs: SonioxRef[];
}

export async function prepareSessionMediaPurge(sessionIds: string[]): Promise<SessionMediaPurge> {
  return { sessionIds, sonioxRefs: await collectUploadSonioxRefs(sessionIds) };
}

export function purgeSessionMedia(p: SessionMediaPurge): void {
  deleteSessionAudioDirs(p.sessionIds);
  releaseSonioxRefs(p.sonioxRefs);
}
