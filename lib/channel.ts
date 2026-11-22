// Channel maths for a time-varying grader (pure, no imports, so node --test can load it).
// The same rules as the backend's pipeline_service.linear_grader_time_varying: the active segment is the first one
// whose effective dates hold the day; each line is interpolated (linearly, or geometrically on a log scale) between
// its two dated points and extended straight beyond them; 5 equal bands between Lower and Upper give 4 thresholds.
// Upper is the cheap line (score 5), Lower the expensive one (score 1). docs/featureAsk-002.md.

type Span = { start?: string; end?: string };
export interface LimitSegment {
  date?: Span;
  upperDate?: Span;
  lowerDate?: Span;
  limit: { startUpper: number; endUpper: number; startLower: number; endLower: number };
  effective_date: Span;
}
export interface ChannelParams {
  scaling?: string;
  limitSegments?: LimitSegment[];
  startDate?: string;
  endDate?: string;
  startUpper?: number;
  endUpper?: number;
  startLower?: number;
  endLower?: number;
}

export interface ChannelPoint {
  lower: number;
  upper: number;
  /** the 4 band edges, from the Lower side to the Upper side */
  thresholds: number[];
}

/** Like JS `new Date(x).getTime()`; date-only strings are UTC. NaN for a missing date (every comparison false). */
const ms = (s: string | undefined) => (s ? Date.parse(s) : NaN);

export const isLog = (p: ChannelParams) => p.scaling === 'log';

/** The segments, or the single legacy segment built from the flat params. */
export function segmentsOf(p: ChannelParams): LimitSegment[] {
  if (p.limitSegments?.length) return p.limitSegments;
  const span = { start: p.startDate, end: p.endDate };
  return [{
    date: span, upperDate: span, lowerDate: span, effective_date: span,
    limit: { startUpper: Number(p.startUpper), endUpper: Number(p.endUpper), startLower: Number(p.startLower), endLower: Number(p.endLower) },
  }];
}

/** The channel on a day (unix ms), or null when no segment is in effect. */
export function channelAt(p: ChannelParams, t: number): ChannelPoint | null {
  const seg = segmentsOf(p).find((s) => ms(s.effective_date?.start) <= t && t <= ms(s.effective_date?.end));
  if (!seg) return null;
  const log = isLog(p);
  const up = seg.upperDate ?? seg.date ?? {};
  const lo = seg.lowerDate ?? seg.date ?? {};
  const lim = seg.limit;
  const interp = (span: Span, a: number, b: number) => {
    const t1 = ms(span.start);
    const t2 = ms(span.end);
    const r = t2 > t1 ? (t - t1) / (t2 - t1) : 0;
    if (log) {
      const s = Math.max(0.0001, a);
      const e = Math.max(0.0001, b);
      return Math.exp(Math.log(s) + r * (Math.log(e) - Math.log(s)));
    }
    return a + r * (b - a);
  };
  const upper = interp(up, lim.startUpper, lim.endUpper);
  const lower = interp(lo, lim.startLower, lim.endLower);
  let thresholds: number[];
  if (log) {
    const lb = Math.max(0.0001, lower);
    const ub = Math.max(0.0001, upper);
    const step = (Math.log(ub) - Math.log(lb)) / 5;
    thresholds = [1, 2, 3, 4].map((k) => Math.exp(Math.log(lb) + step * k));
  } else {
    const step = (upper - lower) / 5;
    thresholds = [1, 2, 3, 4].map((k) => lower + step * k);
  }
  return { lower, upper, thresholds };
}

/** Score 1..5 of a value against the thresholds (pipeline_service.linear_grader). */
export function scoreOf(value: number, thresholds: number[]): number {
  if (thresholds[thresholds.length - 1] < thresholds[0]) {
    for (let i = 0; i < thresholds.length; i++) if (value >= thresholds[i]) return i + 1;
    return thresholds.length + 1;
  }
  for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return i + 1;
  return thresholds.length + 1;
}

const sp = (v: number, log: boolean) => (log ? Math.log(v) : v);
const unsp = (v: number, log: boolean) => (log ? Math.exp(v) : v);

/** The alert levels (featureAsk-001): `range` x the width beyond each line, measured in log space on a log scale. */
export function alertLevels(c: ChannelPoint, log: boolean, range: number): { cheap: number; expensive: number } | null {
  if (log && (c.lower <= 0 || c.upper <= 0)) return null;
  const lo = sp(c.lower, log);
  const up = sp(c.upper, log);
  return { cheap: unsp(up + range * (up - lo), log), expensive: unsp(lo - range * (up - lo), log) };
}

/** Where a value sits: 0 = on the expensive line, 1 = on the cheap line (beyond them below 0 / above 1). */
export function positionIn(value: number, c: ChannelPoint, log: boolean): number | null {
  if (log && (value <= 0 || c.lower <= 0 || c.upper <= 0)) return null;
  const lo = sp(c.lower, log);
  const up = sp(c.upper, log);
  return up === lo ? null : (sp(value, log) - lo) / (up - lo);
}

/** Relative difference, |a - b| / max(|a|, |b|); 0 when both are 0. */
export const relDiff = (a: number, b: number) => {
  const m = Math.max(Math.abs(a), Math.abs(b));
  return m === 0 ? 0 : Math.abs(a - b) / m;
};

export const VALUE_TOLERANCE = 0.005;     // a stored Friday value off the daily computation by more than 0.5%
export const THRESHOLD_TOLERANCE = 0.001; // a stored threshold off the definition by more than 0.1%

export interface PricePoint { t: number; close: number }

/** Latest close on or before t (unix ms) no older than maxAgeDays, or null (pipeline_service.find_latest_close and
 *  its price window). `series` sorted by t. */
export function latestClose(series: PricePoint[], t: number, maxAgeDays: number): number | null {
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  return (t - series[found].t) / 86400000 > maxAgeDays ? null : series[found].close;
}

export type InputKind = 'ratio' | 'minus' | 'single';

/** The input's value from its sides' closes: in1 / in2, in1 - in2, or in1 alone. Null when a side is missing. */
export function inputValue(kind: InputKind, a: number | null, b: number | null): number | null {
  if (a === null) return null;
  if (kind === 'single') return a;
  if (b === null) return null;
  if (kind === 'ratio') return b === 0 ? null : a / b;
  return a - b;
}
