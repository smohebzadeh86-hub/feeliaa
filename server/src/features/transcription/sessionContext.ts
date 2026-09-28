// contextِ ثابتِ Soniox برایِ رونویسیِ جلسه (2026-09-26) — مشترک بینِ realtime (stt_defaults) و async.
// طبقِ docsِ Soniox («Improving speaker diarization»)، اطلاعاتِ گوینده‌ها در context.general به مدل
// کمک می‌کند صداها را قابل‌اعتمادتر جدا کند. تعدادِ دقیقِ حاضرین را از تراپیست نمی‌گیریم (تصمیمِ
// مالک: کارِ اضافه برایِ تراپیست نه) — فقط می‌گوییم ممکن است بیش از دو نفر باشند.
// ⚠️ هیچ دادهٔ مراجع/جلسه اینجا نمی‌آید؛ متنِ ثابت است.
export const SESSION_TRANSCRIPTION_CONTEXT = {
  general: [
    { key: 'domain', value: 'Psychotherapy / counseling' },
    { key: 'setting', value: 'In-person therapy session recorded by a single microphone; may be individual, couple or family therapy' },
    { key: 'speakers', value: 'One therapist and one or more clients; couple and family sessions have 3 or more distinct speakers who must be separated by voice' },
  ],
};
