import {
  customSeriesDefaultOptions,
  type CustomData,
  type CustomSeriesOptions,
  type ICustomSeriesPaneRenderer,
  type ICustomSeriesPaneView,
  type PaneRendererCustomData,
  type PriceToCoordinateConverter,
  type Time,
} from 'lightweight-charts';
import { partScoreColor } from '@/lib/grade-zones';

/**
 * The five score bands of a grading channel, shaded as a lightweight-charts custom series: between Lower and the
 * first band edge in the score-1 colour, ..., between the last edge and Upper in the score-5 colour. The lines
 * themselves are ordinary line series drawn on top (features/charts/channel-chart.tsx). It uses the pane's price
 * scale, so a log axis bends nothing: the bands follow the lines.
 */

/** bounds: Lower, the 4 band edges, Upper (6 values, from the score-1 side to the score-5 side) */
export type BandPoint = CustomData<Time> & { bounds: number[] };

interface BandOptions extends CustomSeriesOptions {
  /** fill opacity 0..1 */
  opacity: number;
}

interface Target {
  useMediaCoordinateSpace<T>(f: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => T): T;
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

class BandRenderer implements ICustomSeriesPaneRenderer {
  private data: PaneRendererCustomData<Time, BandPoint> | null = null;
  private opts: BandOptions | null = null;

  update(data: PaneRendererCustomData<Time, BandPoint>, opts: BandOptions) {
    this.data = data;
    this.opts = opts;
  }

  draw(target: unknown, price: PriceToCoordinateConverter) {
    const { data, opts } = this;
    if (!data || !opts || !data.visibleRange) return;
    (target as Target).useMediaCoordinateSpace(({ context: ctx }) => {
      const from = Math.max(0, data.visibleRange!.from - 1);
      const to = Math.min(data.bars.length, data.visibleRange!.to + 1);
      // each band is a polygon along its top edge and back along its bottom edge; a bar without bounds splits it
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = rgba(partScoreColor(k + 1) ?? '#888888', opts.opacity);
        let run: { x: number; a: number; b: number }[] = [];
        const flush = () => {
          if (run.length > 1) {
            ctx.beginPath();
            run.forEach((p, i) => (i ? ctx.lineTo(p.x, p.a) : ctx.moveTo(p.x, p.a)));
            for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(run[i].x, run[i].b);
            ctx.closePath();
            ctx.fill();
          }
          run = [];
        };
        for (let i = from; i < to; i++) {
          const bar = data.bars[i];
          const b = bar.originalData.bounds;
          const ya = b ? price(b[k]) : null;
          const yb = b ? price(b[k + 1]) : null;
          if (ya === null || yb === null) flush();
          else run.push({ x: bar.x, a: ya, b: yb });
        }
        flush();
      }
    });
  }
}

class BandView implements ICustomSeriesPaneView<Time, BandPoint, BandOptions> {
  private r = new BandRenderer();
  renderer() {
    return this.r;
  }
  update(data: PaneRendererCustomData<Time, BandPoint>, opts: BandOptions) {
    this.r.update(data, opts);
  }
  priceValueBuilder(p: BandPoint) {
    const lo = Math.min(...p.bounds);
    const hi = Math.max(...p.bounds);
    return [lo, hi, hi];
  }
  isWhitespace(d: BandPoint | { time: Time }): d is { time: Time } {
    return !(d as BandPoint).bounds;
  }
  defaultOptions(): BandOptions {
    return { ...customSeriesDefaultOptions, opacity: 0.12 };
  }
}

export const channelBandsView = () => new BandView();
