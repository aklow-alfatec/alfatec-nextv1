import Link from 'next/link';
import { Button, Card, GradeChip, ReadingTag } from '@/components/ui';
import { activePipelines, lastFinalFriday, latestGrades } from '@/lib/grades';
import { latestRiskReward } from '@/lib/risk-reward';
import { listTrades, tradeStats, type TradeView } from '@/lib/trades';
import { currentViewer } from '@/lib/viewer';
import { RiskRewardEditor } from './risk-reward-editor';

export const dynamic = 'force-dynamic';

const money = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
/** Pounds with a sign: +£1,234 / −£56. */
const gbp = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const num = (v: number | null) => (v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }));
const pct = (v: number | null) => (v === null || !Number.isFinite(v) ? '-' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);
const SORTS = { opened: 'Opened', closed: 'Closed', symbol: 'Symbol', pnl: 'Realised', ret: 'Return' } as const;
type Sort = keyof typeof SORTS;

function lastClose(t: TradeView) {
  return t.closures.length ? t.closures[t.closures.length - 1] : null;
}
function ret(t: TradeView) {
  return t.amount > 0 ? (t.is_closed ? t.realized_pnl : t.realized_pnl + t.unrealized_pnl) / t.amount : null;
}

export default async function TradesPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; sort?: string; dir?: string }> }) {
  const sp = await searchParams;
  // guests: read-only, no new trades, no risk / reward editor, no names of who placed a trade
  const guest = (await currentViewer())?.guest ?? true;
  const view = sp.view === 'risk' && !guest ? 'risk' : 'trades';
  const status = sp.status === 'open' || sp.status === 'closed' ? sp.status : 'all';
  const sort: Sort = (sp.sort && sp.sort in SORTS ? sp.sort : 'opened') as Sort;
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';
  const q = (p: Record<string, string>) => `/trades?${new URLSearchParams({ view, status, sort, dir, ...p })}`;
  const seg = (on: boolean) => `px-3 py-1 text-sm ${on ? 'bg-raised text-fg' : 'text-fg-2 hover:text-fg'}`;

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="text-xl font-semibold">Trades</h1>
      {!guest && (
        <div className="flex overflow-hidden rounded-control border border-line-2">
          <Link href="/trades" className={seg(view === 'trades')}>Trades</Link>
          <Link href="/trades?view=risk" className={seg(view === 'risk')}>Risk and reward</Link>
        </div>
      )}
      {!guest && <Link href="/trades/new" className="ml-auto"><Button variant="primary">New trade</Button></Link>}
    </div>
  );

  if (view === 'risk') {
    const pipes = await activePipelines();
    const symbols = [...new Set(pipes.map((p) => p.symbol))].sort();
    const [rows, grades] = await Promise.all([latestRiskReward(symbols), latestGrades(symbols, lastFinalFriday())]);
    return (
      <div className="space-y-4 p-4 md:p-6">
        {header}
        <Card title="Risk and reward plans">
          <RiskRewardEditor
            symbols={symbols}
            rows={rows}
            readings={Object.fromEntries(symbols.map((s) => [s, { reading: grades[s]?.reading ?? null, grade: grades[s]?.grade ?? null, date: grades[s]?.date ?? null }]))}
          />
        </Card>
      </div>
    );
  }

  const all = await listTrades();
  const stats = tradeStats(all);
  const grades = await latestGrades([...new Set(all.map((t) => t.symbol))], lastFinalFriday());
  let trades = all.filter((t) => (status === 'all' ? true : status === 'open' ? !t.is_closed : t.is_closed));
  const key = (t: TradeView): number | string => {
    if (sort === 'symbol') return t.symbol;
    if (sort === 'pnl') return t.realized_pnl;
    if (sort === 'ret') return ret(t) ?? -Infinity;
    if (sort === 'closed') return lastClose(t)?.close_date ?? '';
    return t.entry_date;
  };
  trades = [...trades].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'asc' ? 1 : -1);
  });
  const th = (s: Sort, label: string, right = false) => (
    <th className={`py-1 font-medium ${right ? 'text-right' : 'text-left'}`}>
      <Link href={q({ sort: s, dir: sort === s && dir === 'desc' ? 'asc' : 'desc' })} className="hover:text-fg">
        {label}{sort === s ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
      </Link>
    </th>
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      {header}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <div className={`num text-2xl font-medium ${stats.total >= 0 ? 'text-positive' : 'text-negative'}`}>{money(stats.total)}</div>
          <div className="text-xs text-fg-2">Realised P&amp;L, all trades</div>
        </Card>
        <Card>
          <div className={`num text-2xl font-medium ${stats.wins >= stats.losses ? 'text-positive' : 'text-negative'}`}>{stats.wins} / {stats.count}</div>
          <div className="text-xs text-fg-2">Winners ({(stats.winRate * 100).toFixed(0)}%), {stats.losses} losers</div>
        </Card>
        <Card>
          <div className={`num text-2xl font-medium ${stats.profitFactor >= 1 ? 'text-positive' : 'text-negative'}`}>{stats.profitFactor.toFixed(2)}</div>
          <div className="text-xs text-fg-2">Profit factor ({money(stats.grossWin)} / {money(stats.grossLoss)})</div>
        </Card>
        <Card>
          <div className={`num text-2xl font-medium ${stats.sharpe >= 0 ? 'text-positive' : 'text-negative'}`}>{stats.sharpe.toFixed(2)}</div>
          <div className="text-xs text-fg-2">Sharpe, annualised (10,000 fund, 4.2% risk-free)</div>
        </Card>
      </div>

      <Card
        title={`${trades.length} trade${trades.length === 1 ? '' : 's'}`}
        actions={
          <div className="flex overflow-hidden rounded-control border border-line-2 text-xs">
            {(['all', 'open', 'closed'] as const).map((s) => (
              <Link key={s} href={q({ status: s })} className={`px-2 py-1 ${status === s ? 'bg-raised text-fg' : 'text-fg-2'}`}>{s[0].toUpperCase() + s.slice(1)}</Link>
            ))}
          </div>
        }
      >
        {trades.length === 0 ? (
          <p className="text-sm text-fg-3">No trades.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-fg-3">
                <tr>
                  {th('symbol', 'Symbol')}
                  <th className="py-1 text-left font-medium">Side</th>
                  {!guest && <th className="py-1 text-left font-medium">By</th>}
                  {th('opened', 'Opened')}
                  {th('closed', 'Closed')}
                  <th className="py-1 text-right font-medium">Entry → exit / latest</th>
                  {th('ret', 'Return', true)}
                  <th className="py-1 text-right font-medium">Amount</th>
                  {th('pnl', 'Realised', true)}
                  <th className="py-1 text-right font-medium">Unrealised</th>
                  <th className="py-1 text-center font-medium" title="Grade when the trade opened → this week">Grade</th>
                  <th className="py-1 text-left font-medium">Signal at entry</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const lc = lastClose(t);
                  const r = ret(t);
                  return (
                    <tr key={t.id} className="border-t border-line hover:bg-raised">
                      <td className="py-1.5"><Link href={`/trades/${t.id}`} className="font-semibold hover:text-accent">{t.symbol}</Link></td>
                      <td className="py-1.5 text-xs">{t.side}</td>
                      {!guest && <td className="py-1.5 text-xs text-fg-2">{t.user_name ?? t.user_email ?? ''}</td>}
                      <td className="num py-1.5 text-xs">{t.entry_date}</td>
                      <td className="num py-1.5 text-xs">{t.is_closed && lc ? lc.close_date : <span className="text-info">open</span>}</td>
                      <td className="num py-1.5 text-right text-xs">{num(t.entry_price)} → {t.is_closed && lc ? num(lc.close_price) : num(t.latest_price)}</td>
                      <td className={`num py-1.5 text-right ${(r ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>{pct(r)}</td>
                      <td className="num py-1.5 text-right text-xs">£{num(t.amount)}</td>
                      <td className={`num py-1.5 text-right ${t.realized_pnl >= 0 ? 'text-positive' : 'text-negative'}`}>{gbp(t.realized_pnl)}</td>
                      <td className={`num py-1.5 text-right ${t.unrealized_pnl >= 0 ? 'text-positive' : 'text-negative'}`}>{t.is_closed ? '' : gbp(t.unrealized_pnl)}</td>
                      <td className="py-1.5 text-center">
                        <span className="inline-flex items-center gap-1"><GradeChip grade={t.entry_grade} className="h-5 min-w-7 text-[10px]" />→<GradeChip grade={grades[t.symbol]?.grade ?? null} className="h-5 min-w-7 text-[10px]" /></span>
                      </td>
                      <td className="py-1.5"><ReadingTag reading={t.open_signal} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-fg-3">
          Return of an open trade includes its unrealised P&amp;L at the latest close. Grade: the symbol&apos;s grade when the trade opened → this week
          (higher = more undervalued), to see whether a trade went with the grades.
        </p>
      </Card>
    </div>
  );
}
