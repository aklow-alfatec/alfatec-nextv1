'use client';

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { positionIn, scoreOf } from '@/lib/channel';
import type { ChannelData } from '@/lib/channel-data';
import { partScoreColor } from '@/lib/grade-zones';
import { channelBandsView } from './channel-bands';
import { heatmapView } from './heatmap';

/** Channel chart of one grading component (docs/featureAsk-002.md): the input's daily value; the cheap (Upper) and
 *  expensive (Lower) lines; the 4 band edges with the 5 score bands shaded; the alert lines; the stored Fridays as
 *  dots (red where they disagree with the computation); breach markers; this component's score heatmap below. */

const rgb = (name: string, fallback: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const p = raw.split(/\s+/).map(Number);
  return p.length === 3 && p.every((n) => Number.isFinite(n)) ? `rgb(${p[0]}, ${p[1]}, ${p[2]})` : fallback;
};
const theme = () => ({
  text2: rgb('text-2', '#aeb6c4'), text3: rgb('text-3', '#8a93a4'), line: rgb('line', '#20242e'), line2: rgb('line-2', '#2a303c'),
  positive: rgb('positive', '#4cc38a'), negative: rgb('negative', '#ff8a80'), accent: rgb('accent', '#f2a93b'), warning: rgb('warning', '#f5b83d'),
});

const YEAR = 365.25 * 86400;
const PRICE_COLOR = '#5B9BF0';
const HEAT_PX = 18;
type Range = '1Y' | '5Y' | 'ALL';

/** Index of the last t <= x in a sorted array, or -1. */
function idxAt(t: number[], x: number): number {
  let lo = 0;
  let hi = t.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= x) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

const isoOf = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
export const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 3 : 1 });

interface Readout {
  date: string;
  value: number | null;
  lower: number | null;
  upper: number | null;
  alertCheap: number | null;
  alertExpensive: number | null;
  score: number | null;
  pos: number | null;
  stored: ChannelData['fridays'][number] | null;
  price: number | null;
}

export function ChannelChart({ data }: { data: ChannelData }) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<Range>('ALL');
  const [readout, setReadout] = useState<Readout | null>(null);
  const [heatTop, setHeatTop] = useState<number | null>(null);
  const [priceTop, setPriceTop] = useState<number | null>(null);
  const log = data.scaling === 'log';
  const fridayByDate = useMemo(() => new Map(data.fridays.map((f) => [f.date, f])), [data.fridays]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const th = theme();
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: th.text2,
        fontSize: 11,
        panes: { separatorColor: th.line2, enableResize: false },
      },
      grid: { vertLines: { color: th.line }, horzLines: { color: th.line } },
      rightPriceScale: { borderColor: th.line2, minimumWidth: 64 },
      timeScale: { borderColor: th.line2, rightOffset: 4, minBarSpacing: 0.01 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: th.text3, style: LineStyle.Dashed }, horzLine: { color: th.text3, style: LineStyle.Dashed } },
    });
    chartRef.current = chart;
    const base = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
    const pts = (t: number[], v: (number | null)[]) =>
      t.map((x, i) => (v[i] === null || !Number.isFinite(v[i] as number) || (log && (v[i] as number) <= 0) ? { time: x as Time } : { time: x as Time, value: v[i] as number }));

    // shaded score bands, under everything
    const L = data.lines;
    const bands = chart.addCustomSeries(channelBandsView(), { ...base, opacity: 0.13 }, 0);
    bands.setData(L.t.map((t, i) => {
      const b = [L.lower[i], ...L.edges.map((e) => e[i]), L.upper[i]];
      return b.every((x) => x !== null && (!log || (x as number) > 0)) ? { time: t as Time, bounds: b as number[] } : { time: t as Time };
    }) as never);

    const line = (v: (number | null)[], color: string, width: 1 | 2 | 3, style: LineStyle, title = '') => {
      const s = chart.addSeries(LineSeries, { ...base, color, lineWidth: width, lineStyle: style, title }, 0);
      s.setData(pts(L.t, v) as never);
      return s;
    };
    line(L.alertExpensive, th.negative, 1, LineStyle.LargeDashed);
    line(L.alertCheap, th.positive, 1, LineStyle.LargeDashed);
    L.edges.forEach((e) => line(e, th.text3, 1, LineStyle.Dotted));
    line(L.lower, th.negative, 2, LineStyle.Solid);
    line(L.upper, th.positive, 2, LineStyle.Solid);

    // the input's daily value
    const val = chart.addSeries(LineSeries, { ...base, color: th.accent, lineWidth: 2, lastValueVisible: true, crosshairMarkerVisible: true }, 0);
    val.setData(pts(data.value.t, data.value.v) as never);

    // stored Fridays: grey dots, red where the stored value or thresholds disagree with the computation
    const dots = (ok: boolean, color: string, radius: number) => {
      const s = chart.addSeries(LineSeries, { ...base, color, lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: radius }, 0);
      const fs = data.fridays.filter((f) => f.value !== null && (f.valueOk && f.thresholdsOk) === ok);
      s.setData(fs.map((f) => ({ time: (Date.parse(f.date) / 1000) as Time, value: f.value as number })).filter((p) => !log || p.value > 0) as never);
    };
    dots(true, th.text2, 1.5);
    dots(false, th.negative, 3.5);

    // breach markers on the value line, snapped to its nearest earlier day; the first week of a breach is labelled
    const marks: SeriesMarker<Time>[] = [];
    for (const b of data.breaches) {
      const i = idxAt(data.value.t, Date.parse(b.week) / 1000);
      if (i < 0) continue;
      const color = b.checkData ? th.negative : th.warning;
      // the marker sits on the side the value broke out of: above when that line is the upper one on the chart
      const li = idxAt(L.t, data.value.t[i]);
      const up = li >= 0 ? L.upper[li] : null;
      const lo = li >= 0 ? L.lower[li] : null;
      const cheapOnTop = up !== null && lo !== null ? up > lo : true;
      const above = b.side === 'cheap' ? cheapOnTop : !cheapOnTop;
      marks.push(b.isNew
        ? { time: data.value.t[i] as Time, position: above ? 'aboveBar' : 'belowBar', shape: above ? 'arrowDown' : 'arrowUp', color, text: b.checkData ? 'breach · check data' : 'breach', size: 1 }
        : { time: data.value.t[i] as Time, position: above ? 'aboveBar' : 'belowBar', shape: 'circle', color, size: 0.4 });
    }
    marks.sort((x, y) => (x.time as number) - (y.time as number));
    createSeriesMarkers(val, marks);

    chart.priceScale('right', 0).applyOptions({ mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal, scaleMargins: { top: 0.06, bottom: 0.06 } });

    // the asset's own price, in its own pane on the same time axis
    const px = chart.addSeries(LineSeries, { ...base, color: PRICE_COLOR, lineWidth: 2, lastValueVisible: true }, 1);
    px.setData(data.price.t.map((t, i) => (data.price.v[i] === null ? { time: t as Time } : { time: t as Time, value: data.price.v[i] as number })) as never);
    chart.priceScale('right', 1).applyOptions({ scaleMargins: { top: 0.12, bottom: 0.06 } });

    // this component's score each Friday
    const heat = chart.addCustomSeries(heatmapView(), { rows: 1, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'custom', formatter: () => '', minMove: 1 } }, 2);
    heat.setData(data.fridays.map((f) => ({ time: (Date.parse(f.date) / 1000) as Time, scores: [f.score] })) as never);
    heat.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
    const panes = chart.panes();
    panes[0].setStretchFactor(10);
    panes[1]?.setStretchFactor(4);
    panes[2]?.setStretchFactor(((HEAT_PX + 6) / Math.max(200, el.clientHeight - HEAT_PX)) * 14);
    const measure = () => {
      const ps = chart.panes();
      setPriceTop(ps[1] ? ps[0].getHeight() + 1 : null);
      setHeatTop(ps[2] ? ps[0].getHeight() + ps[1].getHeight() + 2 : null);
    };
    requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(el);

    chart.subscribeCrosshairMove((p) => {
      if (p.time === undefined) {
        setReadout(null);
        return;
      }
      const t = p.time as number;
      const li = idxAt(L.t, t);
      const vi = idxAt(data.value.t, t);
      const value = vi >= 0 && data.value.t[vi] === t ? data.value.v[vi] : vi >= 0 ? data.value.v[vi] : null;
      const lower = li >= 0 ? L.lower[li] : null;
      const upper = li >= 0 ? L.upper[li] : null;
      const edges = li >= 0 ? L.edges.map((e) => e[li]) : [];
      const ch = lower !== null && upper !== null && edges.every((e) => e !== null) ? { lower, upper, thresholds: edges as number[] } : null;
      setReadout({
        date: isoOf(t), value, lower, upper,
        alertCheap: li >= 0 ? L.alertCheap[li] : null, alertExpensive: li >= 0 ? L.alertExpensive[li] : null,
        score: ch && value !== null ? scoreOf(value, ch.thresholds) : null,
        pos: ch && value !== null ? positionIn(value, ch, log) : null,
        stored: fridayByDate.get(isoOf(t)) ?? null,
        price: (() => {
          const pi = idxAt(data.price.t, t);
          return pi >= 0 ? data.price.v[pi] : null;
        })(),
      });
    });

    chart.timeScale().fitContent();
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, log, fridayByDate]);

  // zoom: the last 1 or 5 years of prices plus the 12 months of lines ahead
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const lastPrice = data.value.t[data.value.t.length - 1];
    const lastLine = data.lines.t[data.lines.t.length - 1];
    if (range === 'ALL' || !lastPrice) chart.timeScale().fitContent();
    else chart.timeScale().setVisibleRange({ from: (lastPrice - (range === '1Y' ? 1 : 5) * YEAR) as Time, to: (lastLine ?? lastPrice) as Time });
  }, [range, data]);

  const scoreColor = readout?.score ? partScoreColor(readout.score) : null;
  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-fg-2">
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-accent" />{data.label}</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-positive" />cheap line (score 5)</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-negative" />expensive line (score 1)</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-4 border-t border-dotted border-fg-3" />band edges</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-4 border-t border-dashed border-fg-2" />alert lines ({Math.round(data.alertRange * 100)}% of the width)</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-fg-2" />graded Friday</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-negative" />disagrees</span>
        <div className="ml-auto flex overflow-hidden rounded-control border border-line-2">
          {(['1Y', '5Y', 'ALL'] as Range[]).map((r) => (
            <button key={r} type="button" onClick={() => setRange(r)} className={`px-2 py-0.5 ${r === range ? 'bg-raised text-fg' : 'hover:text-fg'}`}>{r}</button>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" />
        {priceTop !== null && (
          <span className="pointer-events-none absolute left-2 z-[5] inline-flex items-center gap-1 rounded-sm bg-surface/90 px-1 text-[11px] text-fg-2" style={{ top: priceTop + 3 }}>
            <i className="inline-block h-0.5 w-4" style={{ background: PRICE_COLOR }} />{data.symbol} price · daily close
          </span>
        )}
        {heatTop !== null && (
          <span className="pointer-events-none absolute left-1 z-[5] rounded-sm bg-surface/90 px-1 text-[10px] font-medium text-fg" style={{ top: heatTop + 3 }}>score</span>
        )}
        {readout && (
          <div className="pointer-events-none absolute left-2 top-2 z-10 min-w-48 rounded-card border border-line bg-surface/95 px-2 py-1.5 text-[11.5px] shadow">
            <div className="num mb-0.5 text-fg-2">{readout.date}</div>
            <Row k={data.label} v={fmtNum(readout.value)} />
            <Row k="alert (cheap)" v={fmtNum(readout.alertCheap)} />
            <Row k="cheap line" v={fmtNum(readout.upper)} />
            <Row k="expensive line" v={fmtNum(readout.lower)} />
            <Row k="alert (expensive)" v={fmtNum(readout.alertExpensive)} />
            <Row k="in the channel" v={readout.pos === null ? '-' : `${Math.round(readout.pos * 100)}%`} />
            <Row k={`${data.symbol} price`} v={fmtNum(readout.price)} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-fg-2">score</span>
              <span className="num rounded-chip px-1 font-semibold text-black" style={{ background: scoreColor ?? 'transparent' }}>{readout.score ?? '-'}</span>
            </div>
            {readout.stored && (
              <div className={`mt-1 border-t border-line pt-1 ${readout.stored.valueOk && readout.stored.thresholdsOk ? 'text-fg-2' : 'text-negative'}`}>
                graded {fmtNum(readout.stored.value)} · score {readout.stored.score ?? '-'}
                {!(readout.stored.valueOk && readout.stored.thresholdsOk) && ' · disagrees'}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="pt-1 text-[10.5px] text-fg-3">0% in the channel = on the expensive line, 100% = on the cheap line. Lines run 12 months past the last price.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-2">{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}
