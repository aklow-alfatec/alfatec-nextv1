'use client';
import Link from 'next/link';
import { openChannel } from '@/lib/channel-link';
import { pct, type BreachRow } from '@/lib/limit-alert-rules';
import { DayDetailsDialog, useDayDetails } from '../grades/day-details-dialog';

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtNum = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 4 : Math.abs(v) < 100 ? 2 : 0 });

/** Limit breach (docs/featureAsk-001.md): grading pairs beyond a channel line by more than the alert range this
 *  week. New breaches first, then the continuing ones with the week they began. A row opens the week's breakdown. */
export function LimitBreach({ items, date, titles, canOpenChannel = false }: {
  items: BreachRow[]; date: string; titles: Record<string, string>;
  /** admin / superadmin: each pair gets a button that opens its channel chart */
  canOpenChannel?: boolean;
}) {
  const dd = useDayDetails();
  const nNew = items.filter((r) => r.isNew).length;
  const ranges = [...new Set(items.map((r) => r.alertRange))];
  const halves = items.length > 1 ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [items];
  const table = (rows: BreachRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[26%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead className="text-xs text-fg-3">
          <tr>
            <th className="py-1 text-left font-medium">Assets</th>
            <th className="py-1 text-left font-medium">Pair</th>
            <th className="py-1 text-left font-medium">Beyond</th>
            <th className="py-1 text-right font-medium">Excess</th>
            <th className="py-1 pl-3 text-left font-medium">Since</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.symbol}|${r.node}`} className="border-t border-line">
              <td className="truncate py-1.5 pr-2">
                <Link href={`/symbols/${encodeURIComponent(r.symbol)}`} className="font-semibold hover:text-accent">{titles[r.symbol] ?? r.symbol}</Link>
              </td>
              <td className="truncate py-1.5 pr-2 text-fg-2" title={`${r.pair}: value ${fmtNum(r.value)}, line ${fmtNum(r.limitValue)}, alert level ${fmtNum(r.alertLevel)} (${r.scaling})`}>
                <button type="button" onClick={() => dd.show(r.symbol, r.week)} className="hover:text-accent">{r.pair}</button>
                {canOpenChannel && (
                  <button type="button" onClick={() => openChannel(r.symbol, r.node)} title={`Open the ${r.pair} channel chart`}
                    className="ml-1.5 rounded-chip border border-line-2 px-1 text-[10px] leading-4 text-fg-2 hover:border-accent hover:text-accent">chart</button>
                )}
              </td>
              <td className={`py-1.5 text-xs font-medium ${r.side === 'cheap' ? 'text-positive' : 'text-negative'}`}>
                {r.side === 'cheap' ? 'cheap line' : 'expensive line'}
              </td>
              <td className="num py-1.5 text-right font-semibold">
                {pct(r.excess)}
                {r.checkData && <span className="ml-1 rounded-chip bg-warning/15 px-1 text-[10px] font-medium text-warning" title="Large enough to suggest a data problem: check the pair's prices">check data</span>}
              </td>
              <td className="truncate py-1.5 pl-3 text-xs">
                {r.isNew ? <span className="rounded-chip bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">NEW</span> : <span className="text-fg-2">{fmtDay(r.firstBreachWeek)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="rounded-card border border-warning/40 bg-warning/5" aria-label="Limit breach">
      <div className="flex flex-wrap items-baseline gap-x-3 border-b border-warning/30 px-4 py-2">
        <h2 className="text-base font-semibold text-warning">Limit breach</h2>
        <span className="text-xs text-fg-2">
          {items.length} pair{items.length === 1 ? '' : 's'} beyond a channel line by more than {ranges.length === 1 ? pct(ranges[0]) : 'the alert range'} of its width
          {nNew > 0 ? `, ${nNew} new` : ''} · {fmtDay(date)}
        </span>
      </div>
      <div className="px-4 py-2">
        <div className="lg:hidden">{table(items)}</div>
        <div className={`hidden ${halves.length > 1 ? 'lg:grid lg:grid-cols-2' : 'lg:block'}`}>
          {halves.map((rows, k) => (
            <div key={k} className={halves.length > 1 ? (k === 0 ? 'pr-12' : 'border-l border-warning/30 pl-12') : ''}>
              {table(rows)}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-fg-3">
          Excess = distance beyond the line as a share of the channel width (log charts in log space). Cheap line = very
          undervalued, expensive line = very overvalued. Since = first alert week of the breach; it ends when the value is
          back inside the channel. Click a pair for that week&apos;s breakdown; hover it for the value and the line{canOpenChannel ? '; "chart" opens its channel chart' : ''}.
        </p>
      </div>
      <DayDetailsDialog state={dd} />
    </section>
  );
}
