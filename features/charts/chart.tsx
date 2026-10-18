'use client';

import {
  BaselineSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  LineType,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GRADE_ZONES, gradeZone } from '@/lib/grade-zones';
import { BandsPrimitive } from './bands';
import { bandRanges, fmtValue, nearestTime, pairs, valueAt, type EquityData, type PlotSeries, type TradeMark } from './data';
import { PANE_ORDER, PANE_TITLES, type PaneKind } from './layout';
import { GradeZoneLegend } from '@/components/ui';

/** Relative pane heights (stretch factors). */
const STRETCH: Record<PaneKind, number> = { price: 3.2, grade: 1.7, pct: 1.2, score: 1.2, bool: 0.45, other: 1.2, equity: 2 };
const PX_PER_STRETCH = 80;
/** The grade pane plots FLIP - grade so that 20 sits at the top. */
const FLIP = 120;

interface Theme {
  text2: string;
  text3: string;
  line: string;
  line2: string;
  positive: string;
  negative: string;
  accent: string;
  surface: string;
}

const rgb = (name: string, fallback: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const p = raw.split(/\s+/).map(Number);
  return p.length === 3 && p.every((n) => Number.isFinite(n)) ? `rgb(${p[0]}, ${p[1]}, ${p[2]})` : fallback;
};

function readTheme(): Theme {
  return {
    text2: rgb('text-2', '#aeb6c4'),
    text3: rgb('text-3', '#8a93a4'),
    line: rgb('line', '#20242e'),
    line2: rgb('line-2', '#2a303c'),
    positive: rgb('positive', '#4cc38a'),
    negative: rgb('negative', '#ff8a80'),
    accent: rgb('accent', '#f2a93b'),
    surface: rgb('surface', '#12151b'),
  };
}

const alpha = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export interface ReadoutRow { label: string; color: string; text: string }

interface Readout {
  time: number;
  rows: ReadoutRow[];
}

export interface MultiPaneChartProps {
  series: PlotSeries[];
  equity?: EquityData | null;
  /** entry / exit markers, drawn on the first price series */
  trades?: TradeMark[] | null;
  /** pane titles instead of the defaults (layout.ts PANE_TITLES) */
  titles?: Partial<Record<PaneKind, string>>;
  /** extra readout lines for the hovered time (seconds), after the series values */
  extraRows?: (time: number) => ReadoutRow[];
  className?: string;
}

/** Price, grade %, 0-100, part-score, signal, other and equity panes on one time axis (lightweight-charts):
 *  drag to pan, wheel / pinch to zoom, double-click to reset, one crosshair and readout across panes. */
export function MultiPaneChart({ series, equity, trades, titles, extraRows, className }: MultiPaneChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rangeRef = useRef<{ from: Time; to: Time } | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [tops, setTops] = useState<{ kind: PaneKind; top: number }[]>([]);
  const [log, setLog] = useState(true);
  const [themeTick, setThemeTick] = useState(0);

  const panes = useMemo(
    () => PANE_ORDER.filter((k) => (k === 'equity' ? !!equity : series.some((s) => s.pane === k))),
    [series, equity],
  );
  const height = useMemo(() => Math.round(panes.reduce((h, k) => h + STRETCH[k] * PX_PER_STRETCH, 0)) + 40, [panes]);

  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !panes.length) return;
    const th = readTheme();
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: th.text2,
        fontSize: 11,
        panes: { separatorColor: th.line2, separatorHoverColor: alpha('#8a93a4', 0.25), enableResize: true },
      },
      grid: { vertLines: { color: th.line }, horzLines: { color: th.line } },
      rightPriceScale: { borderColor: th.line2, minimumWidth: 56 },
      timeScale: { borderColor: th.line2, timeVisible: false, rightOffset: 2 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: th.text3, style: LineStyle.Dashed }, horzLine: { visible: false, labelVisible: false } },
    });
    chartRef.current = chart;

    const idx = new Map<PaneKind, number>(panes.map((k, i) => [k, i]));
    const lineBase = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
    let anchor: ISeriesApi<'Line'> | null = null;

    for (const s of series) {
      const pane = idx.get(s.pane);
      if (pane === undefined) continue;
      const color = s.faint ? alpha(s.color.startsWith('#') ? s.color : '#a3b1c6', 0.55) : s.color;
      if (s.pane === 'bool') {
        const ln = chart.addSeries(LineSeries, { ...lineBase, lineVisible: false, priceFormat: { type: 'custom', formatter: () => '', minMove: 0.5 }, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }) }, pane);
        ln.setData(pairs(s.t, s.v.map((x) => (x === null ? null : x > 0.5 ? 1 : 0))) as never);
        ln.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0.15 } });
        ln.attachPrimitive(new BandsPrimitive({ time: bandRanges(s), color: alpha(s.color.startsWith('#') ? s.color : '#4cc38a', 0.4) }));
        continue;
      }
      if (s.pane === 'grade') {
        // flipped as nextv0 draws it (20 at the top, 100 = most undervalued at the bottom): the values are mirrored
        // (120 - grade) rather than inverting the scale, because an inverted scale leaks into the panes below it
        const first = series.find((o) => o.pane === 'grade')?.id === s.id;     // the first one gets the zone colours
        const data = pairs(s.t, s.v).map((p) => ({ time: p.time, value: FLIP - Math.min(100, Math.max(20, p.value)), color: first ? (gradeZone(p.value).color ?? th.text3) : s.color }));
        const ln = chart.addSeries(
          LineSeries,
          {
            ...lineBase,
            color: s.color,
            lineWidth: first ? 2 : 1,
            priceFormat: { type: 'custom', formatter: () => '', minMove: 1 },
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 20, maxValue: 100 }, margins: { above: 0, below: 0 } }),
          },
          pane,
        );
        ln.setData(data as never);
        if (first) {
          ln.attachPrimitive(
            new BandsPrimitive({
              price: GRADE_ZONES.filter((z) => z.color && z.max > 20).map((z) => ({ from: FLIP - z.max, to: FLIP - Math.max(z.min, 20), color: alpha(z.color as string, 0.16) })),
            }),
          );
          // the axis is labelled by these lines (the tick labels are blanked: they would sit on the mirrored values)
          for (const v of [20, 30, 40, 80, 90, 100]) ln.createPriceLine({ price: FLIP - v, color: v === 40 || v === 80 ? th.line2 : 'rgba(0,0,0,0)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, axisLabelColor: th.line2, axisLabelTextColor: th.text2, title: String(v) });
        }
        continue;
      }
      const opts: Record<string, unknown> = { ...lineBase, color, lineWidth: s.pane === 'price' && s.id === series.find((o) => o.pane === 'price')?.id ? 2 : 1.5 };
      if (s.pane === 'pct') opts.autoscaleInfoProvider = () => ({ priceRange: { minValue: 0, maxValue: 100 } });
      if (s.pane === 'score') {
        opts.lineType = LineType.WithSteps;
        opts.autoscaleInfoProvider = () => ({ priceRange: { minValue: 0.5, maxValue: 5.5 } });
      }
      const ln = chart.addSeries(LineSeries, opts, pane);
      ln.setData(pairs(s.t, s.v) as never);
      if (s.pane === 'price' && !anchor) anchor = ln;
      const firstOfPane = series.find((o) => o.pane === s.pane)?.id === s.id;
      if (firstOfPane && s.pane === 'pct') for (const v of [20, 40, 60, 80]) ln.createPriceLine({ price: v, color: th.line2, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' });
      if (firstOfPane && s.pane === 'score') {
        ln.createPriceLine({ price: 5, color: th.line2, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '5 undervalued' });
        ln.createPriceLine({ price: 3, color: th.line2, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '3' });
        ln.createPriceLine({ price: 1, color: th.line2, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '1 overvalued' });
      }
    }

    if (equity && idx.has('equity')) {
      const pane = idx.get('equity') as number;
      const eq = chart.addSeries(LineSeries, { ...lineBase, color: th.accent, lineWidth: 2, priceScaleId: 'right' }, pane);
      eq.setData(pairs(equity.t, equity.equity) as never);
      eq.priceScale().applyOptions({ mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal, scaleMargins: { top: 0.06, bottom: 0.32 } });
      if (equity.benchmark) {
        const bh = chart.addSeries(LineSeries, { ...lineBase, color: th.text3, lineWidth: 1, priceScaleId: 'right' }, pane);
        bh.setData(pairs(equity.t, equity.benchmark) as never);
      }
      const dd = chart.addSeries(
        BaselineSeries,
        {
          priceScaleId: 'dd',
          baseValue: { type: 'price', price: 0 },
          topLineColor: th.negative,
          bottomLineColor: th.negative,
          topFillColor1: 'rgba(0,0,0,0)',
          topFillColor2: 'rgba(0,0,0,0)',
          bottomFillColor1: alpha('#ff8a80', 0.05),
          bottomFillColor2: alpha('#ff8a80', 0.35),
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          priceFormat: { type: 'percent' },
        },
        pane,
      );
      dd.setData(pairs(equity.t, equity.drawdown.map((x) => (x === null ? null : x * 100))) as never);
      dd.priceScale().applyOptions({ scaleMargins: { top: 0.72, bottom: 0.02 }, visible: false });
    }

    // entry / exit markers on the first price series, snapped to a bar the series has
    if (anchor && trades?.length) {
      const base = series.find((s) => s.pane === 'price');
      const marks: SeriesMarker<Time>[] = [];
      for (const tr of trades) {
        const a = base ? nearestTime(base.t, tr.entry) : null;
        const b = base ? nearestTime(base.t, tr.exit) : null;
        const long = tr.side !== 'short';
        if (a !== null) marks.push({ time: a as Time, position: long ? 'belowBar' : 'aboveBar', shape: long ? 'arrowUp' : 'arrowDown', color: long ? th.positive : th.negative, size: 1 });
        if (b !== null) marks.push({ time: b as Time, position: long ? 'aboveBar' : 'belowBar', shape: long ? 'arrowDown' : 'arrowUp', color: long ? th.negative : th.positive, size: 1 });
      }
      marks.sort((x, y) => (x.time as number) - (y.time as number));
      createSeriesMarkers(anchor, marks);
    }

    chart.priceScale('right', 0).applyOptions({ scaleMargins: { top: 0.06, bottom: 0.1 } });
    chart.panes().forEach((p, i) => p.setStretchFactor(STRETCH[panes[i]] ?? 1));

    const measure = () => {
      let top = 0;
      const out: { kind: PaneKind; top: number }[] = [];
      chart.panes().forEach((p, i) => {
        out.push({ kind: panes[i], top });
        top += p.getHeight() + 1;
      });
      setTops(out);
    };
    const onRange = (r: { from: Time; to: Time } | null) => {
      if (r) rangeRef.current = r;
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(onRange);
    const onMove = (p: { time?: Time }) => {
      if (p.time === undefined) return setReadout(null);
      const t = p.time as number;
      const rows: Readout['rows'] = [];
      for (const s of series) {
        if (s.pane === 'bool') rows.push({ label: s.label, color: s.color, text: valueAt(s, t) ? 'on' : 'off' });
        else rows.push({ label: s.label, color: s.color, text: fmtValue(s.pane, valueAt(s, t)) });
      }
      if (equity) {
        const e = { t: equity.t, v: equity.equity };
        rows.push({ label: 'Strategy', color: th.accent, text: fmtValue('equity', valueAt(e, t)) });
        if (equity.benchmark) rows.push({ label: 'Buy and hold', color: th.text3, text: fmtValue('equity', valueAt({ t: equity.t, v: equity.benchmark }, t)) });
        const d = valueAt({ t: equity.t, v: equity.drawdown }, t);
        rows.push({ label: 'Drawdown', color: th.negative, text: d === null ? '-' : `${(d * 100).toFixed(1)}%` });
      }
      if (extraRows) rows.push(...extraRows(t));
      setReadout({ time: t, rows });
    };
    chart.subscribeCrosshairMove(onMove as never);

    if (rangeRef.current) {
      try {
        chart.timeScale().setVisibleRange(rangeRef.current);
      } catch {
        chart.timeScale().fitContent();
      }
    } else chart.timeScale().fitContent();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    el.addEventListener('pointerup', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerup', measure);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
      chart.unsubscribeCrosshairMove(onMove as never);
      chart.remove();
      chartRef.current = null;
    };
  }, [series, equity, trades, extraRows, panes, log, themeTick]);

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-end gap-3 text-[11px] text-fg-3">
        <span>Drag to pan, scroll to zoom, double-click to reset</span>
        {equity && (
          <label className="flex items-center gap-1 text-fg-2">
            <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> log equity
          </label>
        )}
      </div>
      <div className="relative">
        <div ref={host} style={{ height }} onDoubleClick={() => chartRef.current?.timeScale().fitContent()} />
        <div className="pointer-events-none absolute inset-0 text-[11px] text-fg-3">
          {tops.map((p) => (
            <span key={p.kind} className="absolute left-2" style={{ top: p.top + 3 }}>{titles?.[p.kind] ?? PANE_TITLES[p.kind]}</span>
          ))}
        </div>
        {readout && (
          <div className="pointer-events-none absolute right-16 top-6 z-10 min-w-40 rounded-card border border-line bg-surface/95 px-2 py-1.5 text-[11.5px] shadow">
            <div className="num mb-0.5 text-fg-2">{new Date(readout.time * 1000).toISOString().slice(0, 10)}</div>
            {readout.rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-fg-2"><i className="inline-block h-0.5 w-3" style={{ background: r.color }} />{r.label}</span>
                <span className="num">{r.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {series.some((s) => s.pane === 'grade') && <GradeZoneLegend compact className="mt-1.5" />}
    </div>
  );
}
