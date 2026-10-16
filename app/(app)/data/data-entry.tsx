'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Select } from '@/components/ui';
import type { CsvRow, ManualRow } from '@/lib/assets';
import { recentValuesAction, saveCsvAction, saveManualAction, type RecomputeResult } from './actions';

const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';
type Saved = { saved: number; recompute: RecomputeResult | { error: string } };

/** dd/mm/yyyy (TradingView export, as nextv0 read it) or yyyy-mm-dd -> yyyy-mm-dd, without time-zone shifts. */
export function normDate(s: string): string | null {
  const t = s.trim().replace(/T.*$/, '');
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** nextv0 CSV rules: header with `time` and `close` (open / high / low optional, default close); M2SL divided by 1e12. */
export function parseCsv(text: string, symbol: string): { rows: CsvRow[]; skipped: number; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], skipped: 0, error: 'The file is empty or has no header' };
  const head = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const ix = (k: string) => head.indexOf(k);
  if (ix('time') === -1 || ix('close') === -1) return { rows: [], skipped: 0, error: 'Columns `time` and `close` are required' };
  const rows: CsvRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const c = line.split(',').map((x) => x.trim());
    const date = normDate(c[ix('time')] ?? '');
    let close = parseFloat(c[ix('close')]);
    let open = ix('open') >= 0 ? parseFloat(c[ix('open')]) : close;
    let high = ix('high') >= 0 ? parseFloat(c[ix('high')]) : close;
    let low = ix('low') >= 0 ? parseFloat(c[ix('low')]) : close;
    if (symbol === 'M2SL') [open, high, low, close] = [close, close, close, close].map((v) => v / 1e12);
    if (!date || [open, high, low, close].some((v) => Number.isNaN(v))) {
      skipped++;
      continue;
    }
    rows.push({ symbol, date, open, high, low, close });
  }
  return { rows, skipped };
}

function Outcome({ res }: { res: Saved }) {
  const rc = res.recompute;
  return (
    <div className="mt-2 rounded border border-line p-2 text-xs">
      <p className="text-positive">Saved {res.saved} row{res.saved === 1 ? '' : 's'}.</p>
      {'error' in rc ? (
        <p className="text-warning">{rc.error}</p>
      ) : (
        <>
          <p className="text-fg-2">
            Grades recomputed {rc.start_friday} → {rc.end_friday} ({rc.weeks} week{rc.weeks === 1 ? '' : 's'}) for{' '}
            {rc.pipelines.length ? rc.pipelines.map((p) => `${p.pipeline}${p.ok ? '' : ' (failed)'}`).join(', ') : 'no active pipeline (none uses these symbols)'}.
          </p>
          {rc.pipelines.filter((p) => !p.ok).map((p) => <p key={p.pipeline} className="text-negative">{p.pipeline}: {p.error}</p>)}
          {rc.notified?.notified_symbols?.length ? <p className="text-fg-2">Grade-change email for: {rc.notified.notified_symbols.join(', ')}{rc.notified.emailed ? '' : ' (email not sent)'}</p> : null}
        </>
      )}
    </div>
  );
}

/** Manual values and CSV upload into stock_data (admins), then the affected pipelines are re-graded. */
export function DataEntry({ symbols, admin }: { symbols: string[]; admin: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<{ symbol: string; date: string; value: string }[]>([{ symbol: '', date: new Date().toISOString().slice(0, 10), value: '' }]);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Saved | null>(null);
  const [recent, setRecent] = useState<{ symbol: string; values: { date: string; close: number }[] } | null>(null);
  const [csvSymbol, setCsvSymbol] = useState('');
  const [csv, setCsv] = useState<{ rows: CsvRow[]; skipped: number; name: string } | null>(null);

  const focusSymbol = rows[rows.length - 1]?.symbol;
  useEffect(() => {
    if (!focusSymbol) return;
    recentValuesAction(focusSymbol).then((values) => setRecent({ symbol: focusSymbol, values }));
  }, [focusSymbol]);

  if (!admin) return <p className="text-sm text-fg-3">Entering data needs an admin account.</p>;

  const submit = async (fn: () => Promise<{ ok: boolean; data?: Saved; error?: string }>, after: () => void) => {
    setBusy(true);
    setError('');
    setResult(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'failed');
    else {
      setResult(r.data!);
      after();
      router.refresh();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Enter values by hand">
        <p className="mb-2 text-xs text-fg-2">For series without an automatic source (NAAIM, manual assets). The value is stored as that day&apos;s open, high, low and close.</p>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-0.5">
                  <select className={cell} value={r.symbol} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, symbol: e.target.value } : x)))}>
                    <option value="">symbol...</option>
                    {symbols.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="py-0.5"><input type="date" className={cell} value={r.date} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, date: e.target.value } : x)))} /></td>
                <td className="py-0.5"><input type="number" step="any" placeholder="value" className={`${cell} w-28`} value={r.value} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} /></td>
                <td className="py-0.5 text-right">{rows.length > 1 && <button className="text-fg-3 hover:text-negative" onClick={() => setRows(rows.filter((_, k) => k !== i))}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="text-xs text-accent hover:underline" onClick={() => setRows([...rows, { ...rows[rows.length - 1], value: '' }])}>+ row</button>
          <label className="flex items-center gap-1 text-xs text-fg-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> email grade changes</label>
          <Button variant="primary" className="ml-auto" disabled={busy}
                  onClick={() => submit(() => saveManualAction(rows.filter((r) => r.symbol && r.value !== '').map((r): ManualRow => ({ symbol: r.symbol, date: r.date, value: Number(r.value) })), notify),
                    () => setRows([{ symbol: rows[0].symbol, date: rows[0].date, value: '' }]))}>
            {busy ? 'Saving...' : 'Save and re-grade'}
          </Button>
        </div>
        {recent && recent.values.length > 0 && (
          <p className="mt-2 text-[11px] text-fg-3">Latest {recent.symbol}: {recent.values.slice(0, 5).map((v) => `${v.date} ${v.close}`).join(' · ')}</p>
        )}
      </Card>

      <Card title="Upload a CSV">
        <p className="mb-2 text-xs text-fg-2">Columns <code>time</code> and <code>close</code> (optional <code>open</code>, <code>high</code>, <code>low</code>), dates as yyyy-mm-dd or dd/mm/yyyy, e.g. a TradingView export. M2SL values are divided by 10¹² as before.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select className="h-8 w-40" value={csvSymbol} onChange={(e) => { setCsvSymbol(e.target.value); setCsv(null); }}>
            <option value="">symbol...</option>
            {symbols.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <input type="file" accept=".csv,text/csv" disabled={!csvSymbol} className="text-xs"
                 onChange={async (e) => {
                   const f = e.target.files?.[0];
                   if (!f) return;
                   const p = parseCsv(await f.text(), csvSymbol);
                   if (p.error) setError(p.error);
                   setCsv({ rows: p.rows, skipped: p.skipped, name: f.name });
                 }} />
        </div>
        {csv && (
          <div className="mt-2 text-xs">
            <p className="text-fg-2">
              {csv.name}: {csv.rows.length} rows{csv.skipped ? `, ${csv.skipped} skipped` : ''}
              {csv.rows.length > 0 && <> · {csv.rows[0].date} → {csv.rows[csv.rows.length - 1].date}</>}
            </p>
            <Button variant="primary" className="mt-2" disabled={busy || !csv.rows.length}
                    onClick={() => submit(() => saveCsvAction(csv.rows, notify), () => setCsv(null))}>
              {busy ? 'Saving...' : `Save ${csv.rows.length} rows and re-grade`}
            </Button>
          </div>
        )}
      </Card>
      {(error || result) && (
        <div className="lg:col-span-2">
          {error && <p className="rounded bg-negative/10 p-2 text-sm text-negative">{error}</p>}
          {result && <Outcome res={result} />}
        </div>
      )}
    </div>
  );
}
