import {
  customSeriesDefaultOptions,
  type CustomData,
  type CustomSeriesOptions,
  type ICustomSeriesPaneRenderer,
  type ICustomSeriesPaneView,
  type PaneRendererCustomData,
  type Time,
} from 'lightweight-charts';
import { partScoreColor } from '@/lib/grade-zones';

export { heatAt, heatPoints, type HeatmapData } from './heat-data';

/**
 * Part-score heatmap as a lightweight-charts custom series: one row per grading part, one cell per Friday, coloured
 * like nextv0's heatmap (5 = undervalued). It sits in its own pane on the chart's time axis, so it zooms and pans
 * with the price and grade panes. Each cell spans from the previous Friday to its own (the week it grades).
 */

type HeatPoint = CustomData<Time> & { scores: (number | null)[] };

interface HeatOptions extends CustomSeriesOptions {
  rows: number;
  /** colour of a cell with no data */
  empty: string;
}

interface Target {
  useMediaCoordinateSpace<T>(f: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => T): T;
}

class HeatRenderer implements ICustomSeriesPaneRenderer {
  private data: PaneRendererCustomData<Time, HeatPoint> | null = null;
  private opts: HeatOptions | null = null;

  update(data: PaneRendererCustomData<Time, HeatPoint>, opts: HeatOptions) {
    this.data = data;
    this.opts = opts;
  }

  draw(target: unknown) {
    const { data, opts } = this;
    if (!data || !opts || !data.visibleRange || opts.rows < 1) return;
    (target as Target).useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const bars = data.bars;
      const rowH = mediaSize.height / opts.rows;
      const gap = rowH > 6 ? 1 : 0;
      // one extra bar on each side, so the cells at the edges are drawn whole
      const from = Math.max(0, data.visibleRange!.from - 1);
      const to = Math.min(bars.length, data.visibleRange!.to + 1);
      for (let i = from; i < to; i++) {
        const b = bars[i];
        const prev = i > 0 ? bars[i - 1].x : b.x - (i + 1 < bars.length ? bars[i + 1].x - b.x : data.barSpacing);
        const x0 = Math.round(prev);
        const w = Math.max(1, Math.round(b.x) - x0 - (b.x - prev > 3 ? 1 : 0));
        b.originalData.scores.forEach((s, r) => {
          ctx.fillStyle = partScoreColor(s) ?? opts.empty;
          ctx.fillRect(x0, Math.round(r * rowH), w, Math.max(1, Math.round(rowH) - gap));
        });
      }
    });
  }
}

class HeatmapView implements ICustomSeriesPaneView<Time, HeatPoint, HeatOptions> {
  private r = new HeatRenderer();
  renderer() {
    return this.r;
  }
  update(data: PaneRendererCustomData<Time, HeatPoint>, opts: HeatOptions) {
    this.r.update(data, opts);
  }
  // a fixed 0..rows range: the pane's scale never moves
  priceValueBuilder(p: HeatPoint) {
    return [0, p.scores.length, p.scores.length];
  }
  isWhitespace(d: HeatPoint | { time: Time }): d is { time: Time } {
    return !(d as HeatPoint).scores;
  }
  defaultOptions(): HeatOptions {
    return { ...customSeriesDefaultOptions, rows: 1, empty: 'rgba(138,147,164,0.18)' };
  }
}

export const heatmapView = () => new HeatmapView();
