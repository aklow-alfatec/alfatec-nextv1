import type { IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, SeriesType, Time } from 'lightweight-charts';

export interface BandSpec {
  /** horizontal bands in price units (grade zones) */
  price?: { from: number; to: number; color: string }[];
  /** vertical bands in unix seconds (signal on) */
  time?: [number, number][];
  /** fill for the time bands */
  color?: string;
}

interface Target {
  useMediaCoordinateSpace<T>(f: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => T): T;
}

/** Shaded bands behind a series: grade zones (horizontal) or "signal on" spans (vertical). */
export class BandsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;
  private spec: BandSpec;
  private views: IPrimitivePaneView[];

  constructor(spec: BandSpec) {
    this.spec = spec;
    const renderer: IPrimitivePaneRenderer = { draw: (t) => this.draw(t as unknown as Target) };
    this.views = [{ zOrder: () => 'bottom', renderer: () => renderer }];
  }

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart;
    this.series = p.series;
  }

  detached() {
    this.chart = null;
    this.series = null;
  }

  paneViews() {
    return this.views;
  }

  private draw(target: Target) {
    const { chart, series, spec } = this;
    if (!chart || !series) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const b of spec.price ?? []) {
        const y1 = series.priceToCoordinate(b.to);
        const y2 = series.priceToCoordinate(b.from);
        if (y1 === null || y2 === null) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(0, Math.min(y1, y2), mediaSize.width, Math.abs(y2 - y1));
      }
      if (spec.time?.length) {
        const ts = chart.timeScale();
        ctx.fillStyle = spec.color ?? 'rgba(76,195,138,0.35)';
        for (const [a, b] of spec.time) {
          const x1 = ts.timeToCoordinate(a as Time) ?? (a < (ts.getVisibleRange()?.from as number) ? 0 : null);
          const x2 = ts.timeToCoordinate(b as Time) ?? (b > (ts.getVisibleRange()?.to as number) ? mediaSize.width : null);
          if (x1 === null || x2 === null || x2 < 0 || x1 > mediaSize.width) continue;
          ctx.fillRect(Math.max(0, x1), 0, Math.max(1, Math.min(mediaSize.width, x2) - Math.max(0, x1)), mediaSize.height);
        }
      }
    });
  }
}
