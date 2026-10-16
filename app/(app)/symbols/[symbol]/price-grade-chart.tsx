import { gradeBucket } from '@/components/ui';

/** Daily close (line) with the weekly grade underneath (bars coloured by grade band). Server-rendered SVG. */
export function PriceGradeChart({ prices, weekly }: {
  prices: { date: string; close: number }[];
  weekly: { date: string; grade: number | null }[];
}) {
  if (prices.length < 2) return <p className="text-sm text-fg-3">No prices in this period.</p>;
  const W = 1000;
  const H = 300;
  const priceH = 210;
  const gTop = 230;
  const gH = 60;
  const t0 = Date.parse(prices[0].date);
  const t1 = Date.parse(prices[prices.length - 1].date);
  const X = (d: string) => ((Date.parse(d) - t0) / (t1 - t0 || 1)) * W;
  const lo = Math.min(...prices.map((p) => p.close));
  const hi = Math.max(...prices.map((p) => p.close));
  const Y = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (priceH - 12);
  const step = Math.max(1, Math.floor(prices.length / 1500));
  const path = prices.filter((_, i) => i % step === 0 || i === prices.length - 1).map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.close).toFixed(1)}`).join('');
  const weeks = weekly.filter((w) => w.date >= prices[0].date);
  const barW = Math.max(1, (W / Math.max(1, (t1 - t0) / (7 * 864e5))) * 0.8);
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 3 : 0 });
  const ticks = [hi, (hi + lo) / 2, lo];
  const years = Array.from(new Set(prices.map((p) => p.date.slice(0, 4))));
  const labelDates = years.length > 1 ? years.map((y) => prices.find((p) => p.date.startsWith(y))!.date) : [prices[0].date, prices[prices.length - 1].date];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[300px] w-full">
        {ticks.map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} className="stroke-line" vectorEffect="non-scaling-stroke" />)}
        <path d={path} fill="none" className="stroke-accent" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {weeks.map((w) =>
          w.grade === null ? null : (
            <rect key={w.date} x={X(w.date) - barW / 2} width={barW} y={gTop + gH - (w.grade / 100) * gH} height={(w.grade / 100) * gH}
                  style={{ fill: `var(--grade-${gradeBucket(w.grade)})` }}>
              <title>{`${w.date}: grade ${Math.round(w.grade)}`}</title>
            </rect>
          ),
        )}
        <line x1={0} x2={W} y1={gTop + gH} y2={gTop + gH} className="stroke-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute inset-0 text-[10px] text-fg-3">
        {ticks.map((v) => <span key={v} className="num absolute right-1" style={{ top: `${(Y(v) / H) * 100}%`, transform: 'translateY(-100%)' }}>{fmt(v)}</span>)}
        <span className="absolute left-1" style={{ top: `${(gTop / H) * 100}%` }}>Grade each Friday</span>
      </div>
      <div className="num relative mt-1 h-4 text-[10px] text-fg-3">
        {labelDates.filter((_, i, a) => a.length <= 12 || i % Math.ceil(a.length / 12) === 0).map((d) => (
          <span key={d} className="absolute -translate-x-1/2" style={{ left: `${(X(d) / W) * 100}%` }}>{years.length > 1 ? d.slice(0, 4) : d}</span>
        ))}
      </div>
    </div>
  );
}
