import { GradeZoneLegend } from '@/components/ui';
import { GRADE_ZONES, gradeZone } from '@/lib/grade-zones';

/** Daily close (top) and the weekly grade % (bottom). The grade pane is flipped as in nextv0's viewer:
 *  20 at the top, 100 (most undervalued) at the bottom, shaded with nextv0's zones, the line coloured by zone. */
export function PriceGradeChart({ prices, weekly }: {
  prices: { date: string; close: number }[];
  weekly: { date: string; grade: number | null }[];
}) {
  if (prices.length < 2) return <p className="text-sm text-fg-3">No prices in this period.</p>;
  const W = 1000;
  const H = 360;
  const priceH = 210;
  const gTop = 234;
  const gH = 110;
  const t0 = Date.parse(prices[0].date);
  const t1 = Date.parse(prices[prices.length - 1].date);
  const X = (d: string) => ((Date.parse(d) - t0) / (t1 - t0 || 1)) * W;
  const lo = Math.min(...prices.map((p) => p.close));
  const hi = Math.max(...prices.map((p) => p.close));
  const Y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (priceH - 12);
  const G = (g: number) => gTop + ((Math.max(20, Math.min(100, g)) - 20) / 80) * gH;   // 20 top -> 100 bottom
  const step = Math.max(1, Math.floor(prices.length / 1500));
  const path = prices.filter((_, i) => i % step === 0 || i === prices.length - 1).map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.close).toFixed(1)}`).join('');
  const weeks = weekly.filter((w) => w.date >= prices[0].date);
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 3 : 0 });
  const ticks = [hi, (hi + lo) / 2, lo];
  const years = Array.from(new Set(prices.map((p) => p.date.slice(0, 4))));
  const labelDates = years.length > 1 ? years.map((y) => prices.find((p) => p.date.startsWith(y))!.date) : [prices[0].date, prices[prices.length - 1].date];
  const segs = weeks.slice(1).map((w, i) => ({ a: weeks[i], b: w })).filter((s) => s.a.grade !== null && s.b.grade !== null);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[360px] w-full">
        {ticks.map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} className="stroke-line" vectorEffect="non-scaling-stroke" />)}
        <path d={path} fill="none" className="stroke-accent" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {GRADE_ZONES.filter((z) => z.color).map((z) => (
          <rect key={z.label} x={0} width={W} y={G(Math.max(z.min, 20))} height={Math.max(0, G(z.max) - G(Math.max(z.min, 20)))} style={{ fill: z.color! }} opacity={0.16}>
            <title>{z.label}</title>
          </rect>
        ))}
        {[40, 80].map((v) => <line key={v} x1={0} x2={W} y1={G(v)} y2={G(v)} className="stroke-line" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />)}
        {segs.map(({ a, b }) => {
          const c = gradeZone(b.grade!).color;
          return (
            <line key={b.date} x1={X(a.date)} y1={G(a.grade!)} x2={X(b.date)} y2={G(b.grade!)} vectorEffect="non-scaling-stroke"
                  strokeWidth={c ? 2.2 : 1.4} style={{ stroke: c ?? 'rgb(var(--text-3))' }}>
              <title>{`${b.date}: grade ${Math.round(b.grade!)} · ${gradeZone(b.grade!).label}`}</title>
            </line>
          );
        })}
        <line x1={0} x2={W} y1={gTop + gH} y2={gTop + gH} className="stroke-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute inset-0 text-[10px] text-fg-3">
        {ticks.map((v) => <span key={v} className="num absolute right-1" style={{ top: `${(Y(v) / H) * 100}%`, transform: 'translateY(-100%)' }}>{fmt(v)}</span>)}
        <span className="absolute left-1 top-0 rounded bg-surface/80 px-1 text-[11px] font-semibold text-fg-2">Price <span className="font-normal text-fg-3">· daily close</span></span>
        <span className="absolute left-1 rounded bg-surface/80 px-1 text-[11px] font-semibold text-fg-2" style={{ top: `${((gTop - 16) / H) * 100}%` }}>
          Grade % <span className="font-normal text-fg-3">· each Friday, undervalued at the bottom</span>
        </span>
        {[20, 40, 80, 100].map((v) => (
          <span key={v} className="num absolute right-1" style={{ top: `${(G(v) / H) * 100}%`, transform: v === 20 ? 'none' : 'translateY(-100%)' }}>{v}</span>
        ))}
      </div>
      <div className="num relative mt-1 h-4 text-[10px] text-fg-3">
        {labelDates.filter((_, i, a) => a.length <= 12 || i % Math.ceil(a.length / 12) === 0).map((d) => (
          <span key={d} className="absolute -translate-x-1/2" style={{ left: `${(X(d) / W) * 100}%` }}>{years.length > 1 ? d.slice(0, 4) : d}</span>
        ))}
      </div>
      <GradeZoneLegend compact className="mt-2" />
    </div>
  );
}
