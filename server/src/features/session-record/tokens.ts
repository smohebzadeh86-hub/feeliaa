// بسته‌بندیِ توکن‌هایِ زمان‌دارِ Soniox برایِ ذخیره در session_transcript_tokens (migration 038).
// قالب v1: gzip( JSON {v:1, t:[[text, start_ms, end_ms, speaker, confidence×100], …]} ) — null برایِ فیلدِ نامعلوم.
// خالص و بدونِ DB؛ خطا ⇒ null (ذخیره‌ی توکن هرگز ثبتِ متن را متوقف نمی‌کند).
import { gunzipSync, gzipSync } from 'node:zlib';
// ساختارِ هم‌شکلِ RecordTokenِ audio-upload (بدونِ وابستگی به آن feature).
export interface RecordToken {
  text: string;
  speaker?: number | string | null;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
}

export const TOKEN_ENGINE = 'soniox-async';
export const TOKEN_MODEL = 'stt-async-v5';

export function packTokens(tokens: RecordToken[] | undefined | null): { gz: Buffer; count: number } | null {
  if (!tokens || !tokens.length) return null;
  try {
    const t = tokens.map((k) => [
      String(k.text ?? ''),
      Number.isFinite(k.start_ms) ? Math.round(k.start_ms as number) : null,
      Number.isFinite(k.end_ms) ? Math.round(k.end_ms as number) : null,
      k.speaker === undefined || k.speaker === null ? null : k.speaker,
      Number.isFinite(k.confidence) ? Math.round((k.confidence as number) * 100) : null,
    ]);
    return { gz: gzipSync(Buffer.from(JSON.stringify({ v: 1, t }), 'utf8')), count: t.length };
  } catch {
    return null;
  }
}

export function unpackTokens(gz: Buffer): RecordToken[] | null {
  try {
    const o = JSON.parse(gunzipSync(gz).toString('utf8'));
    if (!o || o.v !== 1 || !Array.isArray(o.t)) return null;
    return o.t.map((r: any[]) => ({
      text: r[0],
      ...(r[1] !== null ? { start_ms: r[1] } : {}),
      ...(r[2] !== null ? { end_ms: r[2] } : {}),
      ...(r[3] !== null ? { speaker: r[3] } : {}),
      ...(r[4] !== null ? { confidence: r[4] / 100 } : {}),
    }));
  } catch {
    return null;
  }
}
