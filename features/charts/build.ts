/** Turns a layout plus fetched columns into the series the chart draws. Pure. */
import type { StrategyReport } from '../studio/api';
import { toSeconds, type EquityData, type PlotSeries, type TradeMark } from './data.ts';
import type { LayoutSeries } from './layout';

/** Columns of the run's graph as fetched (thinned): one time grid for all of them. */
export interface GraphColumns {
  t: number[];
  cols: Record<string, (number | null)[]>;
}

export interface AddedSeries {
  t: number[];
  v: (number | null)[];
}

export function graphColumns(ts: string[], columns: Record<string, (number | null)[]>): GraphColumns {
  return { t: ts.map(toSeconds), cols: columns };
}

/** Legacy graders report -1 for "no data": not a score. */
const noSentinel = (v: (number | null)[]) => v.map((x) => (x === -1 ? null : x));

export function buildPlot(
  layout: LayoutSeries[],
  graph: GraphColumns | null,
  added: Record<string, AddedSeries>,
  kindOf: (ref: string) => string | undefined,
): PlotSeries[] {
  const out: PlotSeries[] = [];
  for (const s of layout) {
    if (s.special) continue;
    if (s.ref && graph && graph.cols[s.ref]) {
      const v = graph.cols[s.ref];
      out.push({ id: s.id, label: s.label ?? s.ref, pane: s.pane, color: s.color, t: graph.t, v: kindOf(s.ref) === 'part_score' ? noSentinel(v) : v });
    } else if (s.indicator && added[s.id]) {
      out.push({ id: s.id, label: s.label ?? s.indicator.label, pane: s.pane, color: s.color, t: added[s.id].t, v: added[s.id].v, faint: s.indicator.output === 'mid' });
    }
  }
  return out;
}

export function equityFromReport(r: StrategyReport | undefined): EquityData | null {
  if (!r?.curve?.index.length) return null;
  return { t: r.curve.index.map(toSeconds), equity: r.curve.equity, benchmark: r.curve.benchmark, drawdown: r.curve.drawdown };
}

export function tradesFromReport(r: StrategyReport | undefined): TradeMark[] {
  return (r?.trades ?? []).map((t) => ({ entry: toSeconds(t.entry), exit: toSeconds(t.exit), side: t.side, ret: t.return }));
}
