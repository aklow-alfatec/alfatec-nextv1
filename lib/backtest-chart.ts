// Server-side only (reads run files from Storage via lib/run-store.ts).
import { buildPlot, equityFromReport, graphColumns, openTradeFromPosition, tradesFromReport } from '@/features/charts/build';
import { toSeconds, type EquityData, type PlotSeries, type TradeMark } from '@/features/charts/data';
import { initialLayout, resolveLayout } from '@/features/charts/layout';
import { MAX_POINTS } from '@/features/charts/sources';
import type { SeriesInfo, StrategyReport } from '@/features/studio/api';
import { maskedName } from '@/lib/access';
import { openTradeSeries } from '@/lib/open-trade-dd';
import { catalogue, downsample, loadRun } from '@/lib/run-store';

/** A run's chart, ready to draw: the graph's saved layout (or the Strategy preset), its columns fetched here, no
 *  picker. Added indicators are left out (they need the engine). For guests the grading parts are labelled
 *  "Indicator n" and every series id is neutral, so no part name reaches the browser. */
export interface StaticChart {
  /** the most negative open-trade drawdown of the run (percent), for the results table */
  openTradeDdMax?: number | null;
  plot: PlotSeries[];
  equity: EquityData | null;
  trades: TradeMark[] | null;
}

/** Grading parts: ratio inputs and their graders (legacy pipelines), and anything plotted as a part score. */
const isPart = (c: SeriesInfo | undefined) =>
  !!c && (c.kind === 'part_score' || /^legacy\.(getLatestStockRatio|linearGrader)/.test(c.block_type));

export async function staticRunChart(runId: string, savedLayout: unknown, report: StrategyReport | undefined, guest: boolean): Promise<StaticChart | null> {
  const run = await loadRun(runId);
  const cat = catalogue(run) as unknown as SeriesInfo[];
  const layout = initialLayout(savedLayout, cat, report?.price_ref);
  const present = resolveLayout(layout, cat).present.filter((s) => !s.indicator);
  const refs = Array.from(new Set(present.filter((s) => s.ref).map((s) => s.ref as string)));
  const ds = downsample(run, MAX_POINTS, refs);
  // yes / no columns arrive as true / false (as features/charts/sources.ts runSource)
  const cols = Object.fromEntries(Object.entries(ds.columns).map(([k, v]) => [k, v.map((x) => (typeof x === 'boolean' ? Number(x) : (x as number | null)))]));
  const byRef = new Map(cat.map((c) => [c.ref, c]));
  let plot = buildPlot(present, graphColumns(ds.ts, cols), {}, (r) => byRef.get(r)?.kind);
  if (guest) {
    // parts numbered in the graph's order; a ratio (GOLD/UKOIL) and its grader (GOLD/UKOIL_GRADE) share a number
    const partKey = (node: string) => node.replace(/_GRADE$/, '');
    const partNodes = Array.from(new Set(cat.filter(isPart).map((c) => partKey(c.node))));
    const refOf = new Map(present.map((s) => [s.id, s.ref]));
    plot = plot.map((p, i) => {
      const c = byRef.get(refOf.get(p.id) ?? '');
      const label = isPart(c) ? `${maskedName(partNodes.indexOf(partKey(c!.node)))}${c!.port === 'grade' ? ' score' : ''}` : p.label;
      return { ...p, id: `s${i}`, label };
    });
  }
  const has = (k: 'equity' | 'trades') => present.some((s) => s.special === k);
  let trades = has('trades') ? tradesFromReport(report) : null;
  const posRef = report ? `${report.node}.position` : '';
  if (trades && report?.open_position && run.columns[posRef]) {
    // a position still open at the end is not in the report's trade list: add its entry from the position series
    const d = downsample(run, MAX_POINTS, [posRef]);
    const open = openTradeFromPosition(d.ts.map(toSeconds), d.columns[posRef] as (number | null)[]);
    if (open) trades = [...trades, open];
  }
  // open-trade drawdown (from each entry) for the drawdown pane and the results table
  const ot = report ? await openTradeSeries(runId, report.node, report.price_ref).catch(() => null) : null;
  const equity = has('equity') ? equityFromReport(report) : null;
  if (equity && ot) equity.tradeDd = { t: ot.t, v: ot.v };
  return { plot, equity, trades, openTradeDdMax: ot ? ot.max : null };
}
