export interface DiffLine { t: '+' | '-' | ' '; s: string }

/** Line diff via LCS, trimmed to changed hunks with a little context. */
export function lineDiff(a: string, b: string, context = 2): DiffLine[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const n = x.length;
  const m = y.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const all: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { all.push({ t: ' ', s: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) all.push({ t: '-', s: x[i++] });
    else all.push({ t: '+', s: y[j++] });
  }
  while (i < n) all.push({ t: '-', s: x[i++] });
  while (j < m) all.push({ t: '+', s: y[j++] });
  const keep = new Set<number>();
  all.forEach((l, k) => { if (l.t !== ' ') for (let d = -context; d <= context; d++) keep.add(k + d); });
  const out: DiffLine[] = [];
  let gap = false;
  all.forEach((l, k) => {
    if (keep.has(k)) { if (gap) out.push({ t: ' ', s: '…' }); out.push(l); gap = false; } else gap = true;
  });
  return out;
}

export interface PackDiff {
  added: string[];
  removed: string[];
  changed: { path: string; lines: DiffLine[] }[];
}

export function diffPacks(oldFiles: Record<string, string>, newFiles: Record<string, string>): PackDiff {
  const added = Object.keys(newFiles).filter((p) => !(p in oldFiles)).sort();
  const removed = Object.keys(oldFiles).filter((p) => !(p in newFiles)).sort();
  const changed = Object.keys(newFiles)
    .filter((p) => p in oldFiles && oldFiles[p] !== newFiles[p])
    .sort()
    .map((path) => ({ path, lines: lineDiff(oldFiles[path], newFiles[path]) }));
  return { added, removed, changed };
}
