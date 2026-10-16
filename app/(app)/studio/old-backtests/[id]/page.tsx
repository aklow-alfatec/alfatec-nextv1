import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import { EquityChart } from '@/features/studio/results';
import { getOldBacktest } from '@/lib/old-backtests';

export const dynamic = 'force-dynamic';

const pct = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(d)}%` : '-');
const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-');

export default async function OldBacktestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getOldBacktest(id);
  if (!b) notFound();
  const c = b.curve;
  const years = c.index.length > 1 ? (Date.parse(c.index[c.index.length - 1]) - Date.parse(c.index[0])) / (365.25 * 864e5) : 0;
  const cagr = (v: (number | null)[] | null) => {
    if (!v || v.length < 2 || !v[0] || !v[v.length - 1] || years <= 0) return null;
    return (Math.pow((v[v.length - 1] as number) / (v[0] as number), 1 / years) - 1) * 100;
  };
  const mdd = (v: (number | null)[] | null) => {
    if (!v) return null;
    let peak = -Infinity;
    let m = 0;
    for (const x of v) if (x !== null) { peak = Math.max(peak, x); m = Math.min(m, x / peak - 1); }
    return m * 100;
  };
  const s = b.summary as Record<string, number>;
  const rows: [string, string, string][] = [
    ['Total return', pct(b.pnl_percentage), c.benchmark ? pct(((c.benchmark[c.benchmark.length - 1] ?? 0) / (c.benchmark[0] ?? 1) - 1) * 100) : '-'],
    ['CAGR', pct(cagr(c.equity), 2), pct(cagr(c.benchmark), 2)],
    ['Max drawdown (equity)', pct(mdd(c.equity)), pct(mdd(c.benchmark))],
    ['Worst trade drawdown (nextv0)', pct(s.max_trade_drawdown), ''],
    ['Average trade drawdown (nextv0)', pct(s.average_drawdown), ''],
    ['Final value', money(s.final_value), ''],
  ];
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="text-sm text-fg-2">
        <Link href="/studio/runs" className="hover:underline">Runs</Link> / <Link href="/studio/old-backtests" className="hover:underline">Old nextv0 backtests</Link> / {b.name}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{b.name || '(no name)'}</h1>
        <span className="text-sm text-fg-2">{b.pipeline_id} · {b.start_date} to {b.end_date} · fund {money(b.initial_fund)}{b.group_name ? ` · group ${b.group_name}` : ''}</span>
        <span className="ml-auto rounded-chip bg-line px-2 py-0.5 text-xs text-fg-2">read-only, from nextv0</span>
      </div>
      {b.error_message && <p className="rounded bg-negative/10 p-2 text-sm text-negative">{b.error_message}</p>}
      {c.index.length > 1 && (
        <Card title="Equity vs buy and hold">
          <EquityChart curve={{ index: c.index, equity: c.equity, benchmark: c.benchmark, drawdown: c.drawdown }} height={300} />
          <p className="mt-1 text-[11px] text-fg-3">{b.points} weekly positions stored; buy and hold uses the same weekly prices. These were computed with nextv0&apos;s data at the time (see the grade-differences note).</p>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Results">
          <table className="w-full text-sm">
            <thead className="text-xs text-fg-3"><tr><th /><th className="text-right font-medium">Strategy</th><th className="text-right font-medium">Buy and hold</th></tr></thead>
            <tbody>
              {rows.map(([k, a, bh]) => (
                <tr key={k} className="border-t border-line"><td className="py-1 text-fg-2">{k}</td><td className="num py-1 text-right">{a}</td><td className="num py-1 text-right text-fg-2">{bh}</td></tr>
              ))}
            </tbody>
          </table>
          {b.remark && <p className="mt-2 text-xs text-fg-2">Remark: {b.remark}</p>}
        </Card>
        <Card title="Policy">
          <pre className="max-h-72 overflow-auto rounded bg-bg p-2 text-[11px]">{JSON.stringify(b.policy_config, null, 2)}</pre>
          <p className="mt-1 text-[11px] text-fg-3">To trade this policy in the studio, paste its <code>blocks</code> into a graph&apos;s TRIGGERS block (see the strategy graphs).</p>
        </Card>
      </div>
      <Card title={`Transactions (${b.transactions.length})`}>
        <table className="w-full text-sm">
          <thead className="text-xs text-fg-3">
            <tr>{['Date', 'Type', 'Units', 'Price', 'Details'].map((h) => <th key={h} className="py-1 text-left font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {b.transactions.map((t, i) => (
              <tr key={i} className="border-t border-line">
                <td className="num py-1">{t.date}</td>
                <td className={`py-1 ${t.type === 'buy' ? 'text-positive' : 'text-negative'}`}>{t.type}</td>
                <td className="num py-1">{Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                <td className="num py-1">{t.price}</td>
                <td className="py-1 text-xs text-fg-2">{t.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
