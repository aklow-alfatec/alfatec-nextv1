'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { AssetInput, AssetRow } from '@/lib/assets';
import { addAssetAction, deleteAssetAction, updateAssetAction } from './actions';

const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';
type Draft = { name: string; asset_type: string; category: string; inst_id: string; pull_method: string; lag: string };
const draftOf = (a: AssetRow): Draft => ({ name: a.name, asset_type: a.asset_type, category: a.category, inst_id: String(a.inst_id ?? 0),
  pull_method: a.pull_method, lag: a.publication_lag_days === null ? '' : String(a.publication_lag_days) });
const toInput = (d: Draft): Omit<AssetInput, 'symbol'> => ({ name: d.name.trim(), asset_type: d.asset_type.trim(), category: d.category.trim(),
  inst_id: Number(d.inst_id || 0), pull_method: d.pull_method.trim(), publication_lag_days: d.lag.trim() === '' ? null : Number(d.lag) });

/** Asset list with coverage and a "behind" flag; admins can add, edit and delete. */
export function AssetsTable({ assets, behind, admin }: { assets: AssetRow[]; behind: Record<string, number>; admin: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [onlyBehind, setOnlyBehind] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adding, setAdding] = useState<(Draft & { symbol: string }) | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => assets.filter((a) =>
    (!q || `${a.symbol} ${a.name} ${a.category} ${a.pull_method}`.toLowerCase().includes(q.toLowerCase())) && (!onlyBehind || behind[a.symbol] !== undefined)),
  [assets, q, onlyBehind, behind]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) => {
    setBusy(true);
    setError('');
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError((r as { error: string }).error);
    else {
      after();
      router.refresh();
    }
  };
  const fields = (d: Draft, set: (d: Draft) => void) => (
    <>
      <td className="p-1"><input className={`${cell} w-44`} value={d.name} onChange={(e) => set({ ...d, name: e.target.value })} /></td>
      <td className="p-1"><input className={`${cell} w-28`} value={d.category} onChange={(e) => set({ ...d, category: e.target.value })} />
        <input className={`${cell} mt-1 w-28`} value={d.asset_type} onChange={(e) => set({ ...d, asset_type: e.target.value })} /></td>
      <td className="p-1"><input className={`${cell} w-28`} value={d.pull_method} onChange={(e) => set({ ...d, pull_method: e.target.value })} />
        <input className={`${cell} mt-1 w-28`} placeholder="inst_id" value={d.inst_id} onChange={(e) => set({ ...d, inst_id: e.target.value })} /></td>
      <td className="p-1"><input className={`${cell} w-14`} placeholder="none" value={d.lag} onChange={(e) => set({ ...d, lag: e.target.value })} /></td>
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-64" placeholder="search symbol, name, category, source" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1 text-xs text-fg-2"><input type="checkbox" checked={onlyBehind} onChange={(e) => setOnlyBehind(e.target.checked)} /> only behind</label>
        <span className="text-xs text-fg-3">{shown.length} of {assets.length}</span>
        {admin && !adding && (
          <Button className="ml-auto" onClick={() => setAdding({ symbol: '', name: '', asset_type: '', category: '', inst_id: '0', pull_method: 'yfinance', lag: '' })}>Add asset</Button>
        )}
      </div>
      {error && <p className="rounded bg-negative/10 p-2 text-xs text-negative">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-fg-3">
            <tr>
              {['Symbol', 'Name', 'Category / type', 'Source', 'Lag (days)', 'Data from', 'Data to', 'Rows', ''].map((h) => (
                <th key={h} className="p-1 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-t border-line bg-accent/5">
                <td className="p-1"><input className={`${cell} w-28`} placeholder="SYMBOL" value={adding.symbol} onChange={(e) => setAdding({ ...adding, symbol: e.target.value.toUpperCase() })} /></td>
                {fields(adding, (d) => setAdding({ ...adding, ...d }))}
                <td colSpan={3} />
                <td className="p-1 whitespace-nowrap">
                  <Button disabled={busy} onClick={() => act(() => addAssetAction({ symbol: adding.symbol.trim(), ...toInput(adding) }), () => setAdding(null))}>Add</Button>
                  <Button className="ml-1" onClick={() => setAdding(null)}>Cancel</Button>
                </td>
              </tr>
            )}
            {shown.map((a) =>
              edit === a.symbol && draft ? (
                <tr key={a.symbol} className="border-t border-line bg-accent/5">
                  <td className="p-1 font-semibold">{a.symbol}</td>
                  {fields(draft, setDraft)}
                  <td colSpan={3} />
                  <td className="p-1 whitespace-nowrap">
                    <Button disabled={busy} onClick={() => act(() => updateAssetAction(a.symbol, toInput(draft)), () => setEdit(null))}>Save</Button>
                    <Button className="ml-1" onClick={() => setEdit(null)}>Cancel</Button>
                  </td>
                </tr>
              ) : (
                <tr key={a.symbol} className="border-t border-line">
                  <td className="p-1 font-semibold">{a.symbol}</td>
                  <td className="p-1 text-fg-2">{a.name}</td>
                  <td className="p-1 text-xs text-fg-2">{a.category}<span className="block text-fg-3">{a.asset_type}</span></td>
                  <td className="p-1 text-xs text-fg-2 break-all">{a.pull_method}</td>
                  <td className="num p-1 text-xs">{a.publication_lag_days ?? '-'}</td>
                  <td className="num p-1 text-xs">{a.first_date ?? '-'}</td>
                  <td className={`num p-1 text-xs ${behind[a.symbol] !== undefined ? 'text-warning' : ''}`}>
                    {a.last_date ?? 'no data'}{behind[a.symbol] !== undefined && <span className="ml-1">({behind[a.symbol]} d)</span>}
                  </td>
                  <td className="num p-1 text-xs">{a.rows.toLocaleString()}</td>
                  <td className="p-1 whitespace-nowrap text-right">
                    {admin && (
                      <>
                        <button className="text-xs text-accent hover:underline" onClick={() => { setEdit(a.symbol); setDraft(draftOf(a)); }}>edit</button>
                        <button className="ml-2 text-xs text-negative hover:underline" disabled={busy}
                                onClick={() => window.confirm(`Delete asset ${a.symbol}? Its price rows stay in stock_data; pipelines that use it keep working on the old data.`) &&
                                  act(() => deleteAssetAction(a.symbol), () => undefined)}>delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
