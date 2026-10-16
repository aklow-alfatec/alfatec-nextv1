/** Chart layout model: which series sit on which pane, in which colour; presets; load / save helpers.
 *  Pure (no browser or server imports) so node --test can run it. The layout is stored in graph.meta.chart. */
import type { SeriesInfo } from '../studio/api';

export type PaneKind = 'price' | 'grade' | 'pct' | 'score' | 'bool' | 'other' | 'equity';
export const PANE_ORDER: PaneKind[] = ['price', 'grade', 'pct', 'score', 'bool', 'other', 'equity'];
export const PANE_TITLES: Record<PaneKind, string> = {
  price: 'Price',
  grade: 'Daily grade % (undervalued at the bottom)',
  pct: '0-100',
  score: 'Part scores (5 = undervalued, 1 = overvalued)',
  bool: 'Signals',
  other: 'Other',
  equity: 'Equity and drawdown',
};
/** Short pane names for the picker's pane menu. */
export const PANE_NAMES: Record<PaneKind, string> = { price: 'Price', grade: 'Grade %', pct: '0-100', score: 'Scores', bool: 'Signal', other: 'Other', equity: 'Equity' };

/** An indicator the graph does not contain, computed for the run's period (POST /runs/{id}/indicators). */
export interface IndicatorSpec {
  type: string;
  params: Record<string, number | string | boolean>;
  /** a series of the run's graph, "node.port" */
  input: string;
  /** keep one output port of a multi-output block (Bollinger: upper / mid / lower) */
  output?: string;
  label: string;
}

export interface LayoutSeries {
  /** unique within the layout: the ref for graph series, "ind:<label>" for indicators, "@trades" / "@equity" */
  id: string;
  /** graph series ("node.port") */
  ref?: string;
  indicator?: IndicatorSpec;
  /** "trades" = entry / exit markers on the price pane; "equity" = strategy equity, buy and hold, drawdown */
  special?: 'trades' | 'equity';
  label?: string;
  pane: PaneKind;
  color: string;
}

export type PresetName = 'strategy' | 'grade' | 'momentum';
export const PRESETS: { id: PresetName; label: string }[] = [
  { id: 'strategy', label: 'Strategy' },
  { id: 'grade', label: 'Grade' },
  { id: 'momentum', label: 'Momentum' },
];

export interface ChartLayout {
  v: 1;
  /** preset it started from (for the button highlight); "custom" once edited */
  preset?: PresetName | 'custom';
  series: LayoutSeries[];
}

/** Series colours that read on the dark and the light theme. */
export const PALETTE = ['#f2a93b', '#6aa8ff', '#c39bff', '#4cc38a', '#ff8a80', '#2dd4bf', '#f472b6', '#a3b18a'];

export function nextColor(used: string[]): string {
  const count = (c: string) => used.filter((u) => u === c).length;
  return [...PALETTE].sort((a, b) => count(a) - count(b))[0];
}

/** Pane a series opens on, from the catalogue's kind. */
export function paneForKind(kind: SeriesInfo['kind']): PaneKind {
  switch (kind) {
    case 'price': return 'price';
    case 'grade_pct': return 'grade';
    case 'part_score': return 'score';
    case 'bool': return 'bool';
    case 'pct_100': return 'pct';
    default: return 'other';
  }
}

/** Panes a series may be moved to (the grade pane is for 0-100 series: shaded with the grade zones). */
export function allowedPanes(kind: SeriesInfo['kind'] | 'indicator'): PaneKind[] {
  switch (kind) {
    case 'grade_pct':
    case 'pct_100': return ['grade', 'pct', 'other', 'price'];
    case 'part_score': return ['score', 'pct', 'other'];
    case 'bool': return ['bool', 'other'];
    default: return ['price', 'pct', 'other', 'score', 'bool'];
  }
}

// ---- indicators offered under "Add an indicator" (decision D3) ----
export interface MenuIndicator {
  id: string;
  label: string;
  type: string;
  /** output ports to plot, one series each */
  outputs: string[];
  pane: PaneKind;
  params: Record<string, number>;
  /** what the first param is called in the label ("RSI 14") */
  short: string;
}
export const INDICATOR_MENU: MenuIndicator[] = [
  { id: 'rsi', label: 'RSI', type: 'momentum.rsi', outputs: ['rsi'], pane: 'pct', params: { period: 14 }, short: 'RSI' },
  { id: 'sma', label: 'Moving average (SMA)', type: 'trend.sma', outputs: ['sma'], pane: 'price', params: { period: 40 }, short: 'SMA' },
  { id: 'ema', label: 'Moving average (EMA)', type: 'trend.ema', outputs: ['ema'], pane: 'price', params: { period: 40 }, short: 'EMA' },
  { id: 'bb', label: 'Bollinger bands', type: 'volatility.bollinger', outputs: ['upper', 'mid', 'lower'], pane: 'price', params: { period: 20, nbdev: 2 }, short: 'BB' },
  { id: 'z', label: 'Z-score', type: 'stats.zscore', outputs: ['zscore'], pane: 'other', params: { period: 52 }, short: 'Z' },
  { id: 'roc', label: 'Rate of change', type: 'momentum.roc', outputs: ['roc'], pane: 'other', params: { period: 12 }, short: 'ROC' },
  { id: 'atr', label: 'ATR', type: 'volatility.atr', outputs: ['atr'], pane: 'other', params: { period: 14 }, short: 'ATR' },
];

export function indicatorLabel(short: string, params: Record<string, unknown>, output?: string, multi = false): string {
  const first = Object.values(params).find((v) => typeof v === 'number');
  const base = first === undefined ? short : `${short} ${first}`;
  return multi && output ? `${base} ${output}` : base;
}

/** Layout entries for one indicator (one per output port). `input` is "node.port" of the series it is computed on. */
export function indicatorSeries(
  m: Pick<MenuIndicator, 'type' | 'outputs' | 'pane' | 'short'>,
  params: Record<string, number | string | boolean>,
  input: string,
  used: string[],
): LayoutSeries[] {
  const multi = m.outputs.length > 1;
  const color = nextColor(used);
  // the outputs of one block (Bollinger bands) share a colour
  return m.outputs.map((output) => {
    const label = indicatorLabel(m.short, params, output, multi);
    return {
      id: `ind:${label}@${input}`,
      indicator: { type: m.type, params, input, output: multi || output !== m.outputs[0] ? output : undefined, label },
      label,
      pane: m.pane,
      color,
    };
  });
}

// ---- catalogue lookups and presets ----
const isSignal = (s: SeriesInfo) => s.port === 'signal' && s.block_type.startsWith('signal.');

/** The price series of the strategy: its wired price input, else the first price-kind series. */
export function priceSeries(cat: SeriesInfo[], priceRef: string | null | undefined): SeriesInfo | undefined {
  return (priceRef ? cat.find((s) => s.ref === priceRef) : undefined) ?? cat.find((s) => s.kind === 'price' && s.port === 'close') ?? cat.find((s) => s.kind === 'price');
}

export function presetLayout(name: PresetName, cat: SeriesInfo[], priceRef: string | null | undefined): ChartLayout {
  const out: LayoutSeries[] = [];
  const used: string[] = [];
  const add = (s: LayoutSeries) => {
    out.push(s);
    used.push(s.color);
  };
  const fromCat = (s: SeriesInfo, pane?: PaneKind): LayoutSeries => ({
    id: s.ref, ref: s.ref, pane: pane ?? paneForKind(s.kind), color: s.kind === 'price' ? '#a3b1c6' : nextColor(used),
  });
  const px = priceSeries(cat, priceRef);
  if (px) add(fromCat(px));
  const trades: LayoutSeries = { id: '@trades', special: 'trades', label: 'Trades (entries / exits)', pane: 'price', color: '#f2a93b' };
  const equity: LayoutSeries = { id: '@equity', special: 'equity', label: 'Equity vs buy and hold', pane: 'equity', color: '#f2a93b' };
  if (name === 'strategy') {
    add(trades);
    const g = cat.find((s) => s.kind === 'grade_pct');
    if (g) add(fromCat(g));
    const sig = cat.find(isSignal) ?? cat.find((s) => s.kind === 'bool' && s.port === 'fired');
    if (sig) add(fromCat(sig, 'bool'));
  } else if (name === 'grade') {
    const g = cat.find((s) => s.kind === 'grade_pct');
    if (g) add(fromCat(g));
    cat.filter((s) => s.kind === 'part_score').slice(0, 3).forEach((s) => add(fromCat(s)));
  } else if (px) {
    add(trades);
    const sma = INDICATOR_MENU.find((m) => m.id === 'sma')!;
    const rsi = INDICATOR_MENU.find((m) => m.id === 'rsi')!;
    const z = INDICATOR_MENU.find((m) => m.id === 'z')!;
    for (const [m, p] of [[sma, 40], [rsi, 14], [z, 52]] as const) {
      indicatorSeries(m, { period: p }, px.ref, used).forEach(add);
    }
  }
  add(equity);
  return { v: 1, preset: name, series: out };
}

/** Split a layout into entries that can be drawn now and graph series the run does not have (a newer graph
 *  version may have removed a block). */
export function resolveLayout(layout: ChartLayout, cat: SeriesInfo[]): { present: LayoutSeries[]; missing: LayoutSeries[] } {
  const refs = new Set(cat.map((s) => s.ref));
  const present: LayoutSeries[] = [];
  const missing: LayoutSeries[] = [];
  for (const s of layout.series) (s.ref && !refs.has(s.ref) ? missing : present).push(s);
  return { present, missing };
}

/** Accept a stored layout only if it looks like one (graph.meta.chart is user-visible data: never trust it). */
export function parseLayout(raw: unknown): ChartLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { v?: unknown; preset?: unknown; series?: unknown };
  if (r.v !== 1 || !Array.isArray(r.series)) return null;
  const panes = new Set<string>(PANE_ORDER);
  const series: LayoutSeries[] = [];
  for (const s of r.series as Record<string, unknown>[]) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.pane !== 'string' || !panes.has(s.pane) || typeof s.color !== 'string') continue;
    const ind = s.indicator as Record<string, unknown> | undefined;
    const okInd = ind && typeof ind.type === 'string' && typeof ind.input === 'string' && typeof ind.label === 'string' && ind.params && typeof ind.params === 'object';
    const special = s.special === 'trades' || s.special === 'equity' ? s.special : undefined;
    if (!(typeof s.ref === 'string' || okInd || special)) continue;
    series.push({
      id: s.id,
      ref: typeof s.ref === 'string' ? s.ref : undefined,
      indicator: okInd ? (ind as unknown as IndicatorSpec) : undefined,
      special,
      label: typeof s.label === 'string' ? s.label : undefined,
      pane: s.pane as PaneKind,
      color: s.color,
    });
  }
  const preset = r.preset === 'custom' || PRESETS.some((p) => p.id === r.preset) ? (r.preset as ChartLayout['preset']) : undefined;
  return { v: 1, preset, series };
}

/** Layout for a graph: the saved one (graph.meta.chart) if usable, else the Strategy preset. */
export function initialLayout(saved: unknown, cat: SeriesInfo[], priceRef: string | null | undefined): ChartLayout {
  const l = parseLayout(saved);
  return l && l.series.length ? l : presetLayout('strategy', cat, priceRef);
}

export const layoutKey = (graphId: string) => `alfatec.chart.${graphId}`;

/** Same series, panes and colours (ignores the preset tag). */
export function sameLayout(a: ChartLayout | null | undefined, b: ChartLayout | null | undefined): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(a.series) === JSON.stringify(b.series);
}
