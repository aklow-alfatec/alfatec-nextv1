// Server-side only. Data for the channel chart of one grading component (docs/featureAsk-002.md, option C):
// the input's daily value computed from stock_data, the channel lines from the grader's definition, the stored
// Fridays (value, score, thresholds) with a check against the computation, and the limit-breach rows.
import sql from '@/lib/db';
import {
  THRESHOLD_TOLERANCE, VALUE_TOLERANCE, alertLevels, channelAt, inputValue, isLog, latestClose, relDiff, scoreOf,
  type ChannelParams, type InputKind, type PricePoint,
} from '@/lib/channel';
import { DEFAULT_RANGE } from '@/lib/limit-alert-rules';
import { activePipelineFor, pipelineByName } from '@/lib/symbols';

/** The backend's stale-price allowance (pipeline_service: PRICE_WINDOW_DAYS, MAX_AGE_DAYS). */
const PRICE_WINDOW_DAYS = 150;
const MAX_AGE_DAYS: Record<string, number> = { AGE1: 183 };
const maxAge = (s: string) => MAX_AGE_DAYS[s] ?? PRICE_WINDOW_DAYS;
const DAY = 86400000;
/** 7 significant digits for the chart's arrays: far below a pixel, and about half the page's size */
const r7 = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Number(v.toPrecision(7)));
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : new Date(d).toISOString().slice(0, 10));
const KINDS: Record<string, InputKind> = { getLatestStockRatio: 'ratio', getLatestStockMinus: 'minus', getLatestStock: 'single' };

export interface StoredFriday {
  date: string;
  value: number | null;
  score: number | null;
  /** the value computed from prices for that Friday (as dated, and with the sides' publication lags) */
  computed: number | null;
  computedLagged: number | null;
  valueOk: boolean;
  /** largest relative difference of a stored threshold from the definition */
  thresholdDiff: number | null;
  thresholdsOk: boolean;
}

export interface ChannelData {
  symbol: string;
  pipeline: string;
  node: string;
  label: string;
  kind: InputKind;
  in1: string;
  in2: string | null;
  scaling: 'log' | 'linear';
  alertRange: number;
  /** daily input value (unix seconds) */
  value: { t: number[]; v: (number | null)[] };
  /** the lines on the same days plus 12 months ahead (weekly): lower, the 4 band edges, upper, the 2 alert levels */
  lines: { t: number[]; lower: (number | null)[]; upper: (number | null)[]; edges: (number | null)[][]; alertCheap: (number | null)[]; alertExpensive: (number | null)[] };
  fridays: StoredFriday[];
  breaches: { week: string; side: 'cheap' | 'expensive'; excess: number; isNew: boolean; checkData: boolean }[];
}

/** Channel graders (time-varying, input a ratio, difference or single series) of a pipeline, by grader node. */
export function channelNodes(nodes: { cmd: string; outnode: string; params: Record<string, unknown> }[]): Set<string> {
  const inputs = new Set(nodes.filter((n) => n.cmd in KINDS).map((n) => n.outnode));
  return new Set(nodes.filter((n) => n.cmd === 'linearGraderTimeVaryingChain' && inputs.has(String(n.params?.in1))).map((n) => n.outnode));
}

async function closes(symbol: string): Promise<PricePoint[]> {
  const rows = await sql<{ date: Date; close: string }[]>`
    SELECT date, last_close AS close FROM stock_data WHERE symbol = ${symbol} AND last_close IS NOT NULL ORDER BY date`;
  return rows.map((r) => ({ t: Date.parse(iso(r.date)), close: Number(r.close) })).filter((p) => Number.isFinite(p.close));
}

async function lagDays(symbols: string[]): Promise<Record<string, number>> {
  const rows = await sql<{ symbol: string; lag: number | null }[]>`
    SELECT symbol, publication_lag_days AS lag FROM assets WHERE symbol IN ${sql(symbols)}`.catch(() => []);
  return Object.fromEntries(rows.map((r) => [r.symbol, Number(r.lag ?? 0)]));
}

/** `pipelineName`: an inactive pipeline of this asset (Studio -> All assets); its stored Fridays come from
 *  pipeline_grades and it has no limit-breach rows. Omitted: the asset's active pipeline. */
export async function channelData(symbol: string, node: string, pipelineName?: string | null): Promise<ChannelData | null> {
  const named = pipelineName ? await pipelineByName(pipelineName) : null;
  if (pipelineName && (!named || named.symbol !== symbol)) return null;
  const inactive = named && !named.active ? named.name : null;
  const pipe = named ?? (await activePipelineFor(symbol));
  if (!pipe) return null;
  const grader = pipe.nodes.find((n) => n.outnode === node && n.cmd === 'linearGraderTimeVaryingChain');
  const input = grader && pipe.nodes.find((n) => n.outnode === String(grader.params?.in1) && n.cmd in KINDS);
  if (!grader || !input) return null;
  const params = grader.params as ChannelParams;
  const kind = KINDS[input.cmd];
  const in1 = String(input.params.in1);
  const in2 = kind === 'single' ? null : String(input.params.in2);
  const log = isLog(params);

  const [a, b, lags, stored, alerts, rangeRows] = await Promise.all([
    closes(in1),
    in2 ? closes(in2) : Promise.resolve([] as PricePoint[]),
    lagDays(in2 ? [in1, in2] : [in1]),
    inactive
      ? sql<{ date: Date; n: unknown }[]>`SELECT date, jsondata -> 'nodes' -> ${node} AS n FROM pipeline_grades WHERE pipeline = ${inactive} ORDER BY date`
      : sql<{ date: Date; n: unknown }[]>`SELECT date, (jsondata::jsonb) -> 'nodes' -> ${node} AS n FROM daily_indicator_json WHERE symbol = ${symbol} ORDER BY date`,
    // limit-breach alerts are kept for the active pipeline only
    inactive
      ? Promise.resolve([] as { week: Date; side: 'cheap' | 'expensive'; excess: number; is_new: boolean; check_data: boolean }[])
      : sql<{ week: Date; side: 'cheap' | 'expensive'; excess: number; is_new: boolean; check_data: boolean }[]>`
          SELECT week, side, excess, is_new, check_data FROM limit_alerts WHERE symbol = ${symbol} AND node = ${node} ORDER BY week`.catch(() => []),
    sql<{ own: number | null; global: unknown }[]>`
      SELECT (SELECT alert_range FROM pipeline WHERE name = ${pipe.name}) AS own,
             (SELECT value FROM app_settings WHERE key = 'limit_alert.range') AS global`.catch(() => []),
  ]);
  const own = rangeRows[0]?.own;
  const glob = Number(rangeRows[0]?.global);
  const alertRange = own !== null && own !== undefined ? Number(own) : Number.isFinite(glob) ? glob : DEFAULT_RANGE;

  const valueAt = (t: number, lagged = false) => {
    const la = lagged ? (lags[in1] ?? 0) * DAY : 0;
    const lb = lagged && in2 ? (lags[in2] ?? 0) * DAY : 0;
    // a lagged series is visible `lag` days after its stamp: on day t the latest usable stamp is t - lag
    const va = latestClose(a, t - la, maxAge(in1));
    const vb = in2 ? latestClose(b, t - lb, maxAge(in2)) : null;
    return inputValue(kind, va, vb);
  };

  // the days: every day either side has a close, from when both exist
  const first = Math.max(a[0]?.t ?? Infinity, in2 ? (b[0]?.t ?? Infinity) : -Infinity);
  const days = [...new Set([...a.map((p) => p.t), ...b.map((p) => p.t)])].filter((t) => t >= first).sort((x, y) => x - y);
  const value = { t: days.map((t) => t / 1000), v: days.map((t) => r7(valueAt(t))) };

  // lines: the same days, then 12 months ahead at the series' own pace. The chart gives every point the same width,
  // so the future points must be spaced like the past ones (weekdays for a daily series, the usual step for a weekly
  // or monthly one), or the lines bend where the prices end.
  const lineDays = [...days];
  const lastDay = days[days.length - 1] ?? Date.parse(iso(new Date()));
  for (const t of futureDays(days, lastDay, 366)) lineDays.push(t);
  const lines: ChannelData['lines'] = { t: [], lower: [], upper: [], edges: [[], [], [], []], alertCheap: [], alertExpensive: [] };
  for (const t of lineDays) {
    const c = channelAt(params, t);
    const al = c ? alertLevels(c, log, alertRange) : null;
    lines.t.push(t / 1000);
    lines.lower.push(r7(c?.lower ?? null));
    lines.upper.push(r7(c?.upper ?? null));
    for (let k = 0; k < 4; k++) lines.edges[k].push(r7(c?.thresholds[k] ?? null));
    lines.alertCheap.push(r7(al?.cheap ?? null));
    lines.alertExpensive.push(r7(al?.expensive ?? null));
  }

  const fridays: StoredFriday[] = [];
  for (const r of stored) {
    const n = (typeof r.n === 'string' ? JSON.parse(r.n) : r.n) as { value?: number; grade?: number; thresholds?: number[] } | null;
    if (!n || typeof n !== 'object') continue;
    const date = iso(r.date);
    const t = Date.parse(date);
    const sv = Number(n.value);
    const valueStored = Number.isFinite(sv) && sv !== -1 ? sv : null;
    const computed = valueAt(t);
    const computedLagged = valueAt(t, true);
    const valueOk = valueStored === null
      ? computed === null || computedLagged === null
      : [computed, computedLagged].some((c) => c !== null && relDiff(c, valueStored) <= VALUE_TOLERANCE);
    const c = channelAt(params, t);
    const th = Array.isArray(n.thresholds) ? n.thresholds.map(Number) : [];
    const thresholdDiff = c && th.length === 4 ? Math.max(...th.map((x, k) => relDiff(x, c.thresholds[k]))) : null;
    const score = Number.isFinite(Number(n.grade)) && Number(n.grade) >= 1 ? Number(n.grade) : null;
    fridays.push({
      date, value: valueStored, score, computed, computedLagged, valueOk,
      thresholdDiff, thresholdsOk: thresholdDiff === null ? th.length === 0 || !c : thresholdDiff <= THRESHOLD_TOLERANCE,
    });
  }

  return {
    symbol, pipeline: pipe.name, node, label: node.replace(/_GRADE$/, ''), kind, in1, in2,
    scaling: log ? 'log' : 'linear', alertRange, value, lines, fridays,
    breaches: alerts.map((x) => ({ week: iso(x.week), side: x.side, excess: Number(x.excess), isNew: x.is_new, checkData: x.check_data })),
  };
}

/** Days after `last` up to `ahead` days on, spaced like the recent history: weekdays when the series is daily (median
 *  gap of the last 60 points under 4 days), else every `median gap` days. */
export function futureDays(days: number[], last: number, ahead: number): number[] {
  const recent = days.slice(-61);
  const gaps = recent.slice(1).map((t, i) => (t - recent[i]) / DAY).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1;
  const out: number[] = [];
  const end = last + ahead * DAY;
  if (median < 4) {
    for (let t = last + DAY; t <= end; t += DAY) {
      const wd = new Date(t).getUTCDay();
      if (wd !== 0 && wd !== 6) out.push(t);
    }
  } else {
    const step = Math.max(1, Math.round(median)) * DAY;
    for (let t = last + step; t <= end; t += step) out.push(t);
  }
  return out;
}

/** Score of a computed value on a day (for the readout), or null. */
export const scoreAt = (params: ChannelParams, t: number, v: number | null) => {
  const c = channelAt(params, t);
  return c && v !== null ? scoreOf(v, c.thresholds) : null;
};
