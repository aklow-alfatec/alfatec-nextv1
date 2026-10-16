import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { Card, GradeChip, ReadingTag } from '@/components/ui';
import { lastFinalFriday, latestGrades } from '@/lib/grades';
import { getTrade } from '@/lib/trades';
import { TradeActions } from './trade-actions';

export const dynamic = 'force-dynamic';

const num = (v: number | null) => (v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 100 ? 4 : 2 }));
const money = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, session] = await Promise.all([getTrade(id), auth()]);
  if (!t) notFound();
  const me = (session?.user as { id?: string } | undefined)?.id;
  const owner = !!me && me === t.user_id;
  const now = (await latestGrades([t.symbol], lastFinalFriday()))[t.symbol];
  const total = t.realized_pnl + t.unrealized_pnl;
  const facts: [string, React.ReactNode][] = [
    ['Side', t.side],
    ['Entered by', t.user_name ?? t.user_email ?? '-'],
    ['Entry', `${t.entry_date} at ${num(t.entry_price)}`],
    ['Quantity', `${num(t.quantity)}${t.notional ? ' (by amount)' : ''} · remaining ${num(t.remaining_quantity)}`],
    ['Amount', num(t.amount)],
    ['Latest close', num(t.latest_price)],
    ['Realised P&L', <span key="r" className={t.realized_pnl >= 0 ? 'text-positive' : 'text-negative'}>{money(t.realized_pnl)}</span>],
    ['Unrealised P&L', t.is_closed ? '-' : <span key="u" className={t.unrealized_pnl >= 0 ? 'text-positive' : 'text-negative'}>{money(t.unrealized_pnl)}</span>],
    ['Return', t.amount > 0 ? `${((total / t.amount) * 100).toFixed(2)}%` : '-'],
  ];
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="text-sm text-fg-2"><Link href="/trades" className="hover:underline">Trades</Link> / {t.symbol} {t.entry_date}</div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{t.symbol} {t.side.toLowerCase()}</h1>
        <span className={`rounded-chip px-2 py-0.5 text-xs ${t.is_closed ? 'bg-line text-fg-2' : 'bg-info/15 text-info'}`}>{t.is_closed ? 'closed' : 'open'}</span>
        <Link href={`/symbols/${encodeURIComponent(t.symbol)}`} className="text-sm text-accent hover:underline">{t.symbol} page →</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Trade" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-fg-3">{k}</dt>
                <dd className="num">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Grade">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><span className="w-24 text-fg-2">At entry</span><GradeChip grade={t.entry_grade} /><ReadingTag reading={t.open_signal} /></div>
            <div className="flex items-center gap-2"><span className="w-24 text-fg-2">This week</span><GradeChip grade={now?.grade ?? null} /><ReadingTag reading={now?.reading} /></div>
            <p className="text-[11px] text-fg-3">Higher grade = more undervalued. A long opened at a high grade went with the grades.</p>
          </div>
        </Card>
      </div>
      <TradeActions
        owner={owner}
        trade={{ id: t.id, symbol: t.symbol, remaining: t.remaining_quantity, notes: t.notes ?? '', side: t.side, entry_price: t.entry_price }}
        closures={t.closures}
      />
    </div>
  );
}
