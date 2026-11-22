'use client';
import Link from 'next/link';
import { PartScoreChip } from '@/components/ui';
import { DayDetailsDialog, useDayDetails } from './grades/day-details-dialog';

export interface AlertItem {
  symbol: string;
  title: string;
  /** the grading component, e.g. GOLD/COPPER */
  part: string;
  from: number;
  to: number;
  delta: number;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** nextv0's "Ongoing Alert": component grades that moved by more than one point since the previous Friday. A grade
 *  opens that Friday's breakdown of the asset. */
export function OngoingAlert({ items, prevDate, date }: { items: AlertItem[]; prevDate: string; date: string }) {
  const dd = useDayDetails();
  // two or more rows are split in half for the wide layout (a single row stays alone)
  const halves = items.length > 1 ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))] : [items];
  const val = (symbol: string, d: string, v: number) => (
    <button type="button" onClick={() => dd.show(symbol, d)} className="inline-flex items-center gap-1 hover:opacity-80" title={`Open ${symbol} on ${fmtDay(d)}`}>
      <PartScoreChip score={v} className="h-5 min-w-7" />
    </button>
  );
  const table = (rows: AlertItem[]) => (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[28%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="text-xs text-fg-3">
          <tr>
            <th className="py-1 text-left font-medium">Assets</th>
            <th className="py-1 text-left font-medium">Grade</th>
            <th className="py-1 text-center font-medium">Prev week</th>
            <th className="py-1 text-center font-medium">This week</th>
            <th className="py-1 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={`${a.symbol}|${a.part}`} className="border-t border-line">
              <td className="truncate py-1.5 pr-2"><Link href={`/symbols/${encodeURIComponent(a.symbol)}`} className="font-semibold hover:text-accent">{a.title}</Link></td>
              <td className="truncate py-1.5 pr-2 text-fg-2" title={a.part}>{a.part}</td>
              <td className="py-1.5 text-center">{val(a.symbol, prevDate, a.from)}</td>
              <td className="py-1.5 text-center">{val(a.symbol, date, a.to)}</td>
              <td className={`num py-1.5 text-right font-semibold ${a.delta > 0 ? 'text-positive' : 'text-negative'}`}>{a.delta > 0 ? '+' : ''}{a.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="rounded-card border border-negative/40 bg-negative/5" aria-label="Ongoing alert">
      <div className="flex flex-wrap items-baseline gap-x-3 border-b border-negative/30 px-4 py-2">
        <h2 className="text-base font-semibold text-negative">Ongoing alert</h2>
        <span className="text-xs text-fg-2">
          {items.length} component grade{items.length === 1 ? '' : 's'} moved by more than 1 point, {fmtDay(prevDate)} → {fmtDay(date)}
        </span>
      </div>
      <div className="px-4 py-2">
        {/* narrow screens: one table, so every column lines up; wide screens: the list split in half, two tables side
            by side (biggest moves first) with a divider between them */}
        <div className="lg:hidden">{table(items)}</div>
        <div className={`hidden ${halves.length > 1 ? 'lg:grid lg:grid-cols-2' : 'lg:block'}`}>
          {halves.map((rows, k) => (
            <div key={k} className={halves.length > 1 ? (k === 0 ? 'pr-12' : 'border-l border-negative/30 pl-12') : ''}>
              {table(rows)}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-fg-3">Component scores run 1 (overvalued) to 5 (undervalued); green = cheaper than last week. Click a score for that week&apos;s breakdown.</p>
      </div>
      <DayDetailsDialog state={dd} />
    </section>
  );
}
