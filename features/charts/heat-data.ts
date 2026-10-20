/** Heatmap data and lookups (pure, no imports, so node --test can load it). Drawn by heatmap.ts. */
export interface HeatmapData {
  /** part names, top row first */
  rows: string[];
  /** Fridays, unix seconds */
  t: number[];
  /** per Friday, the score of each row (1..5; null = no data) */
  scores: (number | null)[][];
}

/** The series' points from HeatmapData. */
export const heatPoints = (h: HeatmapData): { time: number; scores: (number | null)[] }[] => h.t.map((t, i) => ({ time: t, scores: h.scores[i] ?? [] }));

/** The scores of the Friday at or before `t` (seconds), or null. */
export function heatAt(h: HeatmapData, t: number): (number | null)[] | null {
  let lo = 0;
  let hi = h.t.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (h.t[mid] <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found < 0 ? null : h.scores[found] ?? null;
}
