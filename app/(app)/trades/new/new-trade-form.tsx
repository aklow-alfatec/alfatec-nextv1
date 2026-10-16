'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Input, Select } from '@/components/ui';
import { createTradeAction, priceOnAction } from '../actions';

/** New trade (nextv0 rules): the entry price is the close on or before the entry date unless overridden;
 *  "notional" trades are entered by amount, with quantity 1. */
export function NewTradeForm({ symbols }: { symbols: string[] }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState('');
  const [override, setOverride] = useState(false);
  const [qty, setQty] = useState('');
  const [isNotional, setIsNotional] = useState(false);
  const [notional, setNotional] = useState('');
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (override || !symbol || !date) return;
    let stale = false;
    setLoading(true);
    priceOnAction(symbol, date)
      .then((p) => !stale && setPrice(p === null ? '' : String(p)))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [symbol, date, override]);
  useEffect(() => {
    if (isNotional) setQty('1');
  }, [isNotional]);
  useEffect(() => {
    if (isNotional) return;
    const p = Number(price);
    const q = Number(qty);
    setNotional(p > 0 && q > 0 ? (p * q).toFixed(2) : '');
  }, [price, qty, isNotional]);

  const submit = async () => {
    setError('');
    const p = Number(price);
    const q = Number(qty);
    if (!symbol || !date || !price || !qty || Number.isNaN(p) || Number.isNaN(q)) return setError('Fill in symbol, date, price and quantity.');
    setBusy(true);
    const res = await createTradeAction({ symbol, entry_date: date, entry_price: p, quantity: q, side, notes: notes || undefined,
      notional: isNotional, notional_value: notional ? Number(notional) : null });
    setBusy(false);
    if (res.ok && res.id) router.push(`/trades/${res.id}`);
    else if (!res.ok) setError(res.error);
  };

  const lbl = 'mb-1 block text-xs font-medium text-fg-2';
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="text-sm text-fg-2"><Link href="/trades" className="hover:underline">Trades</Link> / New</div>
      <h1 className="text-xl font-semibold">New trade</h1>
      <Card className="max-w-xl">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Symbol</label>
              <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                <option value="">Choose...</option>
                {symbols.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className={lbl}>Side</label>
              <Select value={side} onChange={(e) => setSide(e.target.value as 'LONG' | 'SHORT')}>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </Select>
            </div>
            <div>
              <label className={lbl}>Entry date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Entry price {loading && <span className="text-fg-3">(loading)</span>}</label>
              <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!override} />
              <label className="mt-1 flex items-center gap-1 text-xs text-fg-2">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> enter the price myself
              </label>
            </div>
            <div>
              <label className={lbl}>Quantity</label>
              <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} disabled={isNotional} />
              <label className="mt-1 flex items-center gap-1 text-xs text-fg-2">
                <input type="checkbox" checked={isNotional} onChange={(e) => setIsNotional(e.target.checked)} /> enter by amount (notional)
              </label>
            </div>
            <div>
              <label className={lbl}>Amount</label>
              <Input type="number" step="any" value={notional} onChange={(e) => setNotional(e.target.value)} disabled={!isNotional} />
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea className="w-full rounded-control border border-line-2 bg-bg px-2 py-1 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Create trade'}</Button>
            <Link href="/trades"><Button>Cancel</Button></Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
