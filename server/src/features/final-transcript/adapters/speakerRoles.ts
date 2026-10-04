// نقشِ هر شماره‌ی گوینده‌ی Soniox در «متنِ نهایی» (core-data-plan-2026-10-03، قدمِ ۳) — منبعِ پیشنهادِ نقش در نوارِ «نقشِ گوینده‌ها».
// فقط متنِ نهاییِ done با source=async (شماره‌ها در کلِ جلسه یکدست و همان کلیدهایِ رکوردِ canonical). نقشِ اکثریتِ نوبت‌هایِ هر
// گوینده (نقشِ LLM یا اصلاحِ تراپیست). فقط‌خواندنی؛ هر خطا ⇒ null.
import { query } from '../../../db/connection.js';

export async function finalTranscriptSpeakerRoles(sessionId: string): Promise<Record<string, string> | null> {
  try {
    const r = await query(`SELECT clean_turns FROM final_transcripts WHERE session_id = ? AND stage = 'done' AND source = 'async'`, [sessionId]);
    const raw = r.rows[0]?.clean_turns;
    const turns = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(turns)) return null;
    const votes = new Map<string, Map<string, number>>();
    for (const t of turns) {
      if (!t || t.marker || typeof t.role !== 'string' || !t.role.trim() || t.sp === undefined || t.sp === null || t.sp === '') continue;
      const sp = String(t.sp);
      const m = votes.get(sp) ?? new Map<string, number>();
      m.set(t.role.trim(), (m.get(t.role.trim()) ?? 0) + 1);
      votes.set(sp, m);
    }
    const out: Record<string, string> = {};
    for (const [sp, m] of votes) {
      const best = [...m.entries()].sort((a, b) => b[1] - a[1]);
      // تساویِ دو نقشِ متفاوت برایِ یک گوینده ⇒ بدونِ پیشنهاد (Soniox احتمالاً دو نفر را ادغام کرده)
      if (best.length > 1 && best[0][1] === best[1][1]) continue;
      out[sp] = best[0][0];
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
