// سرو کردنِ فایل با پشتیبانیِ HTTP Range (برایِ <audio> که scrub می‌کند).
import { createReadStream } from 'node:fs';
import type { FastifyReply } from 'fastify';

// پارسِ امنِ Range: bytes=start-end با clamp به اندازه‌ی واقعیِ فایل.
// خروجی null یعنی range غیرقابلِ‌ارضا (باید 416 برگردد) — قبلاً start فراتر از
// stat.size منجر به Content-Length منفی و پاسخِ خراب می‌شد.
export function parseRange(rangeHeader: string, size: number): { start: number; end: number } | null {
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!m || (!m[1] && !m[2])) return null;
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : size - 1;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (!m[1] && m[2]) {
    // فرمِ suffix: bytes=-N یعنی N بایتِ آخر
    start = Math.max(0, size - end);
    end = size - 1;
  }
  if (start > end || start < 0 || start >= size) return null;
  if (end >= size) end = size - 1;
  return { start, end };
}

// Range ⇒ 206 (یا 416 برایِ رنجِ نامعتبر)؛ بدونِ Range ⇒ کلِ فایل. ترتیبِ هدرها همان است که بود.
export function sendFileWithRange(
  reply: FastifyReply,
  range: string | undefined,
  filePath: string,
  size: number,
  contentType: string
) {
  if (range) {
    const parsed = parseRange(range, size);
    if (!parsed) {
      reply.code(416);
      reply.header('Content-Range', `bytes */${size}`);
      return reply.send();
    }
    const { start, end } = parsed;
    reply.code(206);
    reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Content-Length', end - start + 1);
    reply.header('Content-Type', contentType);
    return reply.send(createReadStream(filePath, { start, end }));
  }
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Content-Length', size);
  reply.header('Content-Type', contentType);
  return reply.send(createReadStream(filePath));
}
