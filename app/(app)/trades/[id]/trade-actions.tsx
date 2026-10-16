'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import type { Closure } from '@/lib/trades';
import { closeTradeAction, deleteClosureAction, deleteTradeAction, priceOnAction, updateClosureAction, updateNotesAction } from '../actions';

const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';
const money = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/** Closures list, close form, notes and delete. Changes are allowed for the trade's owner only (checked again on the server). */
export function TradeActions({ owner, trade, closures }: {
  owner: boolean;
  trade: { id: string; symbol: string; remaining: number; notes: string; side: 'LONG' | 'SHORT'; entry_price: number };
  closures: Closure[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(trade.notes);
  const [close, setClose] = useState({ date: new Date().toISOString().slice(0, 10), price: '', qty: String(trade.remaining > 0 ? trade.remaining : ''), notes: '', custom: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ date: '', price: '', qty: '', notes: '', custom: '' });

  useEffect(() => {
    if (!owner || trade.remaining <= 0) return;
    let stale = false;
    priceOnAction(trade.symbol, close.date).then((p) => !stale && p !== null && setClose((c) => ({ ...c, price: String(p) })));
    return () => {
      stale = true;
    };
  }, [close.date, owner, trade.symbol, trade.remaining]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError('');
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError((r as { error: string }).error);
    else {
      after?.();
      router.refresh();
    }
  };
  const pl = (c: Closure) => (c.custom_pl !== null ? c.custom_pl : c.quantity_closed * (trade.side === 'SHORT' ? trade.entry_price - c.close_price : c.close_price - trade.entry_price));

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-negative/10 p-2 text-sm text-negative">{error}</p>}
      <Card title={`Closures (${closures.length})`}>
        {closures.length === 0 ? (
          <p className="text-sm text-fg-3">Not closed yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-fg-3">
              <tr>{['Date', 'Price', 'Quantity', 'P&L', 'Notes', ''].map((h) => <th key={h} className="py-1 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {closures.map((c) =>
                editing === c.id ? (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-1"><input type="date" className={cell} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></td>
                    <td className="py-1"><input type="number" step="any" className={`${cell} w-24`} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></td>
                    <td className="py-1"><input type="number" step="any" className={`${cell} w-20`} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /></td>
                    <td className="py-1"><input type="number" step="any" placeholder="auto" className={`${cell} w-24`} value={draft.custom} onChange={(e) => setDraft({ ...draft, custom: e.target.value })} /></td>
                    <td className="py-1"><input className={`${cell} w-40`} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></td>
                    <td className="py-1 text-right">
                      <Button disabled={busy} onClick={() => act(() => updateClosureAction(trade.id, c.id, {
                        close_date: draft.date, close_price: Number(draft.price), quantity: Number(draft.qty), notes: draft.notes,
                        custom_pl: draft.custom.trim() === '' ? null : Number(draft.custom),
                      }), () => setEditing(null))}>Save</Button>
                      <Button className="ml-1" onClick={() => setEditing(null)}>Cancel</Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} className="border-t border-line">
                    <td className="num py-1">{c.close_date}</td>
                    <td className="num py-1">{c.close_price}</td>
                    <td className="num py-1">{c.quantity_closed}</td>
                    <td className={`num py-1 ${pl(c) >= 0 ? 'text-positive' : 'text-negative'}`}>{money(pl(c))}{c.custom_pl !== null && <span className="ml-1 text-[10px] text-fg-3">entered</span>}</td>
                    <td className="py-1 text-xs text-fg-2">{c.notes}</td>
                    <td className="py-1 text-right">
                      {owner && (
                        <>
                          <button className="text-xs text-accent hover:underline" onClick={() => {
                            setEditing(c.id);
                            setDraft({ date: c.close_date, price: String(c.close_price), qty: String(c.quantity_closed), notes: c.notes ?? '', custom: c.custom_pl === null ? '' : String(c.custom_pl) });
                          }}>edit</button>
                          <button className="ml-2 text-xs text-negative hover:underline" disabled={busy}
                                  onClick={() => window.confirm('Delete this closure?') && act(() => deleteClosureAction(trade.id, c.id))}>delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </Card>

      {owner && trade.remaining > 0 && (
        <Card title="Close (all or part)">
          <div className="grid max-w-3xl grid-cols-2 gap-2 md:grid-cols-5">
            <div><label className="text-xs text-fg-2">Date</label><Input type="date" value={close.date} onChange={(e) => setClose({ ...close, date: e.target.value })} /></div>
            <div><label className="text-xs text-fg-2">Price</label><Input type="number" step="any" value={close.price} onChange={(e) => setClose({ ...close, price: e.target.value })} /></div>
            <div><label className="text-xs text-fg-2">Quantity (max {trade.remaining})</label><Input type="number" step="any" value={close.qty} onChange={(e) => setClose({ ...close, qty: e.target.value })} /></div>
            <div><label className="text-xs text-fg-2">P&amp;L (optional)</label><Input type="number" step="any" placeholder="auto" value={close.custom} onChange={(e) => setClose({ ...close, custom: e.target.value })} /></div>
            <div><label className="text-xs text-fg-2">Notes</label><Input value={close.notes} onChange={(e) => setClose({ ...close, notes: e.target.value })} /></div>
          </div>
          <Button variant="primary" className="mt-3" disabled={busy} onClick={() => act(() => closeTradeAction(trade.id, {
            close_date: close.date, close_price: Number(close.price), quantity: Number(close.qty), notes: close.notes || undefined,
            custom_pl: close.custom.trim() === '' ? null : Number(close.custom),
          }), () => setClose((c) => ({ ...c, notes: '', custom: '' })))}>Record closure</Button>
          <p className="mt-1 text-[11px] text-fg-3">The price is the close on or before the date; change it if you got a different fill. Leave P&amp;L empty to work it out from the prices.</p>
        </Card>
      )}

      <Card title="Notes">
        {owner ? (
          <>
            <textarea className="w-full rounded-control border border-line-2 bg-bg px-2 py-1 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <Button disabled={busy || notes === trade.notes} onClick={() => act(() => updateNotesAction(trade.id, notes))}>Save notes</Button>
              <Button className="ml-auto text-negative" disabled={busy}
                      onClick={() => window.confirm('Delete this trade? It is hidden from every list (nextv0 keeps a soft-deleted copy).') &&
                        act(() => deleteTradeAction(trade.id), () => router.push('/trades'))}>Delete trade</Button>
            </div>
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-fg-2">{trade.notes || 'No notes.'} <span className="block text-[11px] text-fg-3">Only the person who entered this trade can change it.</span></p>
        )}
      </Card>
    </div>
  );
}
