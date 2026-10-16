/** Pure helpers for the chart: time conversion, lookups for the crosshair readout, shaded bands. */
import type { PaneKind } from './layout';

/** One series ready to draw: ascending unix seconds with a value (or null) each. */
export interface PlotSeries {
  id: string;
  label: string;
  pane: PaneKind;
  color: string;
  t: number[];
  v: (number | null)[];
  /** drawn lighter (middle band of Bollinger bands) */
  faint?: boolean;
}

export interface EquityData {
  t: number[];
  equity: (number | null)[];
  benchmark: (number | null)[] | null;
  drawdown: (number | null)[];
}

export interface TradeMark {
  entry: number;
  exit: number;
  side: string;
  ret: number | null;
}

/** ISO timestamp from the engine (naive = UTC) to unix seconds. */
export function toSeconds(iso: string): number {
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(iso);
  return Date.parse(hasZone ? iso : `${iso}Z`) / 1000;
}

/** Index of the last time <= `time` in an ascending array, or -1. */
export function indexAtOrBefore(t: number[], time: number): number {
  let lo = 0;
  let hi = t.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= time) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Value at or just before `time` (the crosshair readout: series may sit on different time grids). */
export function valueAt(s: { t: number[]; v: (number | null)[] }, time: number): number | null {
  const i = indexAtOrBefore(s.t, time);
  return i < 0 ? null : s.v[i];
}

/** The series time nearest to `time` (markers must sit on a bar the series has). */
export function nearestTime(t: number[], time: number): number | null {
  if (!t.length) return null;
  const i = indexAtOrBefore(t, time);
  if (i < 0) return t[0];
  if (i === t.length - 1) return t[i];
  return time - t[i] <= t[i + 1] - time ? t[i] : t[i + 1];
}

/** Time spans where a signal is on (value above 0.5). A missing sample keeps the state, so a signal that is only
 *  reported when it changes (1 at the entry, 0 at the exit) still shades the whole span; each span runs to the
 *  sample that turned it off. */
export function bandRanges(s: { t: number[]; v: (number | null)[] }): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i < s.t.length; i++) {
    const x = s.v[i];
    if (x === null || x === undefined || !Number.isFinite(x)) continue;
    const on = x > 0.5;
    if (on && start === null) start = s.t[i];
    if (!on && start !== null) {
      out.push([start, s.t[i]]);
      start = null;
    }
  }
  if (start !== null && s.t.length) out.push([start, s.t[s.t.length - 1]]);
  return out;
}

/** Drop nulls (a line series takes whitespace points, but plain pairs keep the payload small). */
export function pairs(t: number[], v: (number | null)[]): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  let last = -Infinity;
  for (let i = 0; i < t.length; i++) {
    const x = v[i];
    if (x === null || x === undefined || !Number.isFinite(x) || t[i] <= last) continue;
    out.push({ time: t[i], value: x });
    last = t[i];
  }
  return out;
}

export function fmtValue(pane: PaneKind, v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  if (pane === 'equity') return Math.round(v).toLocaleString();
  if (pane === 'score' || pane === 'bool') return String(Math.round(v * 100) / 100);
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString();
  return v.toFixed(Math.abs(v) < 1 ? 4 : 2);
}
