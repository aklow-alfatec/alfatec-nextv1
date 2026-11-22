'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/ui';
import type { LimitAlertSettings } from '@/lib/limit-alerts';
import { savePipelineAlertRangeAction, saveLimitAlertAction } from './actions';

const asPct = (v: number) => String(Math.round(v * 100000) / 1000);

/** Limit-breach alert settings (docs/featureAsk-001.md): the global range, the check-data level and per-pipeline
 *  overrides. Any full account; a change re-evaluates the stored alerts. */
export function LimitAlertCard({ settings }: { settings: LimitAlertSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [range, setRange] = useState(asPct(settings.range));
  const [check, setCheck] = useState(asPct(settings.checkDataAbove));
  const [over, setOver] = useState<Record<string, string>>(
    Object.fromEntries(settings.pipelines.map((p) => [p.name, p.alertRange === null ? '' : asPct(p.alertRange)])));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const overridden = settings.pipelines.filter((p) => p.alertRange !== null).length;

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      setError('');
      setNote('');
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'failed');
      else {
        setNote(r.message ?? 'Saved.');
        router.refresh();
      }
    });

  return (
    <Card title="Limit-breach alerts">
      <p className="mb-3 text-xs text-fg-3">
        A grading pair alerts when its value is beyond a channel line by more than the alert range, as a share of the
        channel width (in log space for log charts). The Dashboard shows the week&apos;s breaches and the Friday email lists
        them. Breaches above the check-data level are marked as a possible data problem.
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => saveLimitAlertAction(range, check));
        }}
      >
        <label className="text-xs text-fg-2">
          Alert range, % of width
          <Input className="mt-1 w-28" inputMode="decimal" value={range} onChange={(e) => setRange(e.target.value)} />
        </label>
        <label className="text-xs text-fg-2">
          Check data above, %
          <Input className="mt-1 w-28" inputMode="decimal" value={check} onChange={(e) => setCheck(e.target.value)} />
        </label>
        <Button type="submit" size="sm" disabled={pending}>Save</Button>
      </form>
      {settings.updatedBy && settings.updatedAt && (
        <p className="mt-1 text-[11px] text-fg-3">Last changed by {settings.updatedBy}, {new Date(settings.updatedAt).toLocaleString('en-GB')}</p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-fg-2">
          Per-asset range ({overridden} overridden; empty = the global {asPct(settings.range)}%)
        </summary>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {settings.pipelines.map((p) => (
              <tr key={p.name} className="border-t border-line">
                <td className="py-1 pr-2 font-medium">{p.symbol}</td>
                <td className="py-1 pr-2 text-xs text-fg-3">{p.name}</td>
                <td className="py-1 pr-2">
                  <Input className="w-20" inputMode="decimal" placeholder={asPct(settings.range)} value={over[p.name] ?? ''}
                    onChange={(e) => setOver({ ...over, [p.name]: e.target.value })} />
                </td>
                <td className="py-1 text-right">
                  <Button size="sm" disabled={pending || (over[p.name] ?? '') === (p.alertRange === null ? '' : asPct(p.alertRange))}
                    onClick={() => act(() => savePipelineAlertRangeAction(p.name, over[p.name] ?? ''))}>Save</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      {note && <p className="mt-2 text-xs text-positive">{note}</p>}
    </Card>
  );
}
