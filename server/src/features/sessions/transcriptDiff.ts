// تفاوتِ دو نسخه‌ی متنِ جلسه در سطحِ پاراگراف (F8، 2026-10-02) — خالص، بدونِ I/O. برایِ مرورِ تاریخچه و «بازگردانی».
// LCS رویِ پاراگراف‌ها (خطِ خالی = جداکننده)؛ سقفِ اندازه برایِ جلوگیری از O(n*m) بزرگ.
export type DiffOp = { op: 'same' | 'removed' | 'added'; text: string };

const MAX_PARAGRAPHS = 3000;

export function splitParagraphs(t: string): string[] {
  return String(t || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function diffParagraphs(oldText: string, newText: string): { ops: DiffOp[]; truncated: boolean } {
  const a = splitParagraphs(oldText);
  const b = splitParagraphs(newText);
  if (a.length > MAX_PARAGRAPHS || b.length > MAX_PARAGRAPHS) return { ops: [], truncated: true };
  const n = a.length, m = b.length;
  // dp[i][j] = طولِ LCS از a[i..] و b[j..]
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'removed', text: a[i++] }); }
    else { ops.push({ op: 'added', text: b[j++] }); }
  }
  while (i < n) ops.push({ op: 'removed', text: a[i++] });
  while (j < m) ops.push({ op: 'added', text: b[j++] });
  return { ops, truncated: false };
}

export function diffSummary(ops: DiffOp[]): { same: number; removed: number; added: number } {
  const s = { same: 0, removed: 0, added: 0 };
  for (const o of ops) s[o.op]++;
  return s;
}
