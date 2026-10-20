'use client';

import dynamic from 'next/dynamic';
import type { EquityData, PlotSeries, TradeMark } from './data';

const MultiPaneChart = dynamic(() => import('./chart').then((m) => m.MultiPaneChart), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-fg-3">Loading chart...</p>,
});

/** A run's chart as its graph's saved layout shows it, without the picker or presets: nothing to change or save
 *  (lib/backtest-chart.ts builds it on the server). */
export function StaticRunChart({ plot, equity, trades }: { plot: PlotSeries[]; equity: EquityData | null; trades: TradeMark[] | null }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
        {plot.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5" style={{ background: s.color }} />{s.label}</span>
        ))}
        {equity && <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 bg-accent" />Strategy <i className="ml-2 inline-block h-0.5 w-3.5 bg-fg-3" />Buy and hold</span>}
      </div>
      <MultiPaneChart series={plot} equity={equity} trades={trades} />
    </div>
  );
}
