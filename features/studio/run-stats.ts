/** Summary statistics of a set of run results (the runs a search matches). Pure, for node --test. */
export interface Stats {
  n: number;
  average: number | null;
  max: number | null;
  min: number | null;
  median: number | null;
  /** most frequent value at the shown precision; null when no value repeats */
  mode: number | null;
  /** how many runs share the mode */
  modeCount: number;
}

/** `step`: the precision values are shown at (e.g. 0.001 for a return shown as 12.3%); the mode is taken at it. */
export function stats(values: (number | null | undefined)[], step: number): Stats {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n, average: null, max: null, min: null, median: null, mode: null, modeCount: 0 };
  const mid = n >> 1;
  const counts = new Map<number, number>();
  for (const x of v) {
    const k = Math.round(x / step);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 1;
  // the most frequent rounded value; a tie goes to the lowest one
  for (const [k, c] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (c > bestN) {
      best = k;
      bestN = c;
    }
  }
  return {
    n,
    average: v.reduce((s, x) => s + x, 0) / n,
    max: v[n - 1],
    min: v[0],
    median: n % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2,
    mode: best === null ? null : best * step,
    modeCount: best === null ? 0 : bestN,
  };
}
