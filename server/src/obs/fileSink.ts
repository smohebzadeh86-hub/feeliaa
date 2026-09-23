// نوشتنِ JSONLِ چرخشی — بدونِ dependencyِ جدید (طبقِ پلن؛ نه pino-roll، نه هیچ‌چیزِ دیگر).
// مسیر: data/logs/obs.jsonl. سقفِ حجم: MAX_BYTES در هر فایل × (KEEP+1) فایل ≈ ۴۸MB.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, type WriteStream } from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(process.cwd(), 'data', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'obs.jsonl');
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024; // ۸MB برایِ هر فایل
function readMaxBytes(): number {
  const raw = Number(process.env.OBS_LOG_MAX_BYTES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_BYTES;
}
const MAX_BYTES = readMaxBytes();
const KEEP = 5; // obs.jsonl + obs.jsonl.1..5 → سقفِ دیسک ~۴۸MB

let stream: WriteStream | null = null;
let bytesWritten = 0;
let sinkBroken = false;
let ensured = false;

function ensureDir() {
  if (ensured) return;
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // اگر پوشه ساخته نشود، openStream هم بعداً fail می‌شود و sinkBroken می‌شود — fail-open
  }
  ensured = true;
}

function currentSize(): number {
  try {
    return statSync(LOG_FILE).size;
  } catch {
    return 0;
  }
}

function openStream(): WriteStream | null {
  try {
    ensureDir();
    const s = createWriteStream(LOG_FILE, { flags: 'a' });
    s.on('error', () => {
      // خطایِ استریم (مثلاً دیسک پر/EACCES) → فقط خاموش شو، هرگز throw/crash نکن.
      sinkBroken = true;
      try { s.close(); } catch {}
      if (stream === s) stream = null;
    });
    bytesWritten = currentSize();
    return s;
  } catch {
    sinkBroken = true;
    return null;
  }
}

// obs.jsonl.4 → .5، ..، .1 → .2، obs.jsonl → .1، سپس استریمِ تازه
function rotate() {
  try {
    if (stream) {
      try { stream.end(); } catch {}
      stream = null;
    }
    for (let i = KEEP - 1; i >= 1; i--) {
      const src = `${LOG_FILE}.${i}`;
      const dst = `${LOG_FILE}.${i + 1}`;
      if (existsSync(src)) {
        try { renameSync(src, dst); } catch {}
      }
    }
    if (existsSync(LOG_FILE)) {
      try { renameSync(LOG_FILE, `${LOG_FILE}.1`); } catch {}
    }
    bytesWritten = 0;
  } catch {
    // rotate ناموفق → همچنان با همان فایل ادامه بده (fail-open)، بعدی دوباره تلاش می‌کند
  }
}

// همگام است (هیچ caller نباید منتظرِ نوشتنِ دیسک بماند) — هرگز throw نمی‌کند.
export function writeJsonl(obj: unknown): void {
  try {
    if (sinkBroken) return;
    ensureDir();
    if (!stream) {
      stream = openStream();
      if (!stream) return;
    }
    if (bytesWritten >= MAX_BYTES) {
      rotate();
      stream = openStream();
      if (!stream) return;
    }
    const line = JSON.stringify(obj) + '\n';
    bytesWritten += Buffer.byteLength(line, 'utf-8');
    stream.write(line);
  } catch {
    // no-op — این تابع هرگز نباید callerِ اصلی را fail کند
  }
}

export function isFileSinkBroken(): boolean {
  return sinkBroken;
}
