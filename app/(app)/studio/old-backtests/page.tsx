import Link from 'next/link';
import { Card } from '@/components/ui';
import { listOldBacktests, oldBacktestFilters } from '@/lib/old-backtests';

export const dynamic = 'force-dynamic';

const pct = (v: number | null, d = 1) => (v === null ? '-' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);

export default async function OldBacktestsPage({ searchParams }: { searchParams: Promise<{ pipeline?: string; group?: string; q?: string }> }) {
  const sp = await searchParams;
  const [rows, filters] = await Promise.all([listOldBacktests(sp), oldBacktestFilters()]);
  const sel = 'rounded-control border border-line-2 bg-bg px-2 py-1 text-sm';
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="text-sm text-fg-2"><Link href="/studio/runs" className="hover:underline">Runs</Link> / Old nextv0 backtests</div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Old nextv0 backtests</h1>
          <p className="text-sm text-fg-2">Read-only: the results saved by nextv0&apos;s trading backtest pages. New backtests run in the studio.</p>
        </div>
        <form className="ml-auto flex flex-wrap gap-2" action="/studio/old-backtests">
          <input name="q" defaultValue={sp.q ?? ''} placeholder="name" className={`${sel} w-32`} />
          <select name="pipeline" defaultValue={sp.pipeline ?? ''} className={sel}>
            <option value="">All pipelines</option>
            {filters.pipelines.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select name="group" defaultValue={sp.group ?? ''} className={sel}>
            <option value="">All groups</option>
            {filters.groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.n})</option>)}
          </select>
          <button className="rounded-control border border-line-2 px-3 py-1 text-sm hover:bg-raised">Filter</button>
        </form>
      </div>
      <Card title={`${rows.length} backtest${rows.length === 1 ? '' : 's'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-fg-3">
              <tr>
                {['Name', 'Pipeline', 'Group', 'Period', 'Return', 'P&L', 'Buys / sells', 'Avg drawdown', 'Status', 'Saved'].map((h, i) => (
                  <th key={h} className={`py-1 font-medium ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-line hover:bg-raised">
                  <td className="py-1"><Link href={`/studio/old-backtests/${b.id}`} className="font-medium hover:text-accent">{b.name || '(no name)'}</Link></td>
                  <td className="py-1 text-xs">{b.pipeline_id}</td>
                  <td className="py-1 text-xs text-fg-2">{b.group_name ?? ''}</td>
                  <td className="num py-1 text-xs">{b.start_date?.slice(0, 4)}–{b.end_date?.slice(0, 4)}</td>
                  <td className={`num py-1 text-right ${(b.pnl_percentage ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>{pct(b.pnl_percentage)}</td>
                  <td className="num py-1 text-right text-xs">{b.pnl_value === null ? '-' : b.pnl_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="num py-1 text-right text-xs">{b.buy_count ?? '-'} / {b.sell_count ?? '-'}</td>
                  <td className="num py-1 text-right text-xs">{b.average_drawdown === null ? '-' : `${b.average_drawdown.toFixed(1)}%`}</td>
                  <td className="py-1 text-xs text-fg-2">{b.status}</td>
                  <td className="num py-1 text-xs text-fg-3">{b.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
