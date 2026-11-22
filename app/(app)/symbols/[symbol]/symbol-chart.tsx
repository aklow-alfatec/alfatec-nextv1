'use client';
import { useCallback, useMemo } from 'react';
import { MultiPaneChart, type ReadoutRow } from '@/features/charts/chart';
import type { PlotSeries } from '@/features/charts/data';
import type { HeatmapData } from '@/features/charts/heatmap';
import { openChannel } from '@/lib/channel-link';
import { GRADE_ZONES, gradeZone, readingInfo } from '@/lib/grade-zones';

/** price and grade panes the same height (the chart's total height is unchanged) */
const EQUAL_PANES = { price: 2.45, grade: 2.45 };

const sec = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000;
/** the compared pipeline's grade line: orange, dotted */
const COMPARE_COLOR = '#F2A93B';
const COMPARE_SWATCH = `repeating-linear-gradient(90deg, ${COMPARE_COLOR} 0 3px, transparent 3px 6px)`;
/** the main grade line is coloured by zone: its legend swatch shows the zone colours (overvalued -> undervalued) */
const ZONE_SWATCH = `linear-gradient(90deg, ${GRADE_ZONES.map((z) => z.color ?? '#8a93a4').reverse().join(', ')})`;

/** Symbol page chart on the shared multi-pane chart (features/charts): daily close (upper pane) and the weekly
 *  grade % (lower pane, flipped with nextv0's zones), drag to pan, scroll to zoom, one crosshair. The readout adds
 *  the day's change, the grade's zone and the reading of the week shown. The earlier SVG chart and a lighter
 *  crosshair option for it are described in doc/symbol-chart-options.md. */
export function SymbolChart({ symbol, pipeline, prices, weekly, heatmap, channelNodes, gradeName, compare }: {
  symbol: string;
  /** an inactive pipeline shown instead of the active one (its channel charts open for it) */
  pipeline?: string | null;
  prices: { date: string; close: number }[];
  weekly: { date: string; grade: number | null; reading: number | null }[];
  /** part scores per Friday, drawn as a heatmap pane under the grade (names already masked for guests) */
  heatmap?: HeatmapData | null;
  /** per heatmap row, the grader node whose channel chart its name opens (null: plain text). Admins only. */
  channelNodes?: (string | null)[];
  /** the pipeline whose grade is drawn (named in the pane title when a comparison is shown) */
  gradeName?: string | null;
  /** a second grade line from another pipeline of this asset (admins) */
  compare?: { name: string; weekly: { date: string; grade: number | null }[] } | null;
}) {
  const series = useMemo<PlotSeries[]>(() => {
    const wk = weekly.filter((w) => w.grade !== null);
    return [
      { id: 'close', label: 'Close', pane: 'price', color: '#5B9BF0', t: prices.map((p) => sec(p.date)), v: prices.map((p) => p.close) },
      { id: 'grade', label: compare ? `Grade % ${gradeName ?? ''}`.trim() : 'Grade %', pane: 'grade', color: '#8a93a4', t: wk.map((w) => sec(w.date)), v: wk.map((w) => w.grade) },
      ...(compare
        ? [{ id: 'grade-compare', label: `Grade % ${compare.name}`, pane: 'grade' as const, color: COMPARE_COLOR, dotted: true,
            t: compare.weekly.filter((w) => w.grade !== null).map((w) => sec(w.date)), v: compare.weekly.filter((w) => w.grade !== null).map((w) => w.grade) }]
        : []),
    ];
  }, [prices, weekly, compare, gradeName]);

  const extraRows = useCallback(
    (t: number): ReadoutRow[] => {
      const rows: ReadoutRow[] = [];
      const i = prices.findLastIndex((p) => sec(p.date) <= t);
      if (i > 0) {
        const chg = (prices[i].close / prices[i - 1].close - 1) * 100;
        rows.push({ label: 'Day change', color: 'transparent', text: `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` });
      }
      const w = [...weekly].reverse().find((x) => sec(x.date) <= t && x.grade !== null);
      if (w) {
        const z = gradeZone(w.grade as number);
        rows.push({ label: 'Zone', color: z.color ?? '#8a93a4', text: z.label });
        if (w.reading !== null) rows.push({ label: 'Reading', color: readingInfo(w.reading).color ?? '#8a93a4', text: readingInfo(w.reading).label });
        rows.push({ label: 'Graded on', color: 'transparent', text: w.date });
      }
      return rows;
    },
    [prices, weekly],
  );

  if (prices.length < 2) return <p className="text-sm text-fg-3">No prices in this period.</p>;
  return (
    <MultiPaneChart
      series={series}
      extraRows={extraRows}
      titles={{
        price: 'Price · daily close',
        grade: compare ? 'Grade % · undervalued at the bottom' : 'Grade % · each Friday, undervalued at the bottom',
      }}
      legends={compare ? { grade: [{ label: gradeName ?? 'this pipeline', swatch: ZONE_SWATCH }, { label: compare.name, swatch: COMPARE_SWATCH }] } : undefined}
      stretch={EQUAL_PANES}
      heatmap={heatmap}
      onHeatRow={channelNodes ? (r) => channelNodes[r] && openChannel(symbol, channelNodes[r] as string, pipeline) : undefined}
      heatRowEnabled={channelNodes?.map(Boolean)}
    />
  );
}
