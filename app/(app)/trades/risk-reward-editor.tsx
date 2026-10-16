'use client';

import { useState } from 'react';
import { Button, GradeChip } from '@/components/ui';
import type { Bias, RiskRewardRow } from '@/lib/risk-reward';
import { saveRiskRewardAction } from './actions';

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a || 1);
/** Same rule as lib/risk-reward.ratioText (nextv0): round both up, reduce. */
function ratio(risk: number, reward: number): string | null {
  const a = Math.ceil(risk);
  const b = Math.ceil(reward);
  if (!(a > 0 && b > 0)) return null;
  const g = gcd(a, b);
  return `${a / g}:${b / g}`;
}

type Edit = { bias: Bias; risk: string; reward: string; months: string; ratio: string; date: string };
const today = () => new Date().toISOString().slice(0, 10);
const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';

/** Edit each symbol's planned bias, risk %, reward % and expected holding period; saves changed rows dated today. */
export function RiskRewardEditor({ symbols, rows, readings }: {
  symbols: string[];
  rows: RiskRewardRow[];
  readings: Record<string, { label: string; grade: number | null; date: string | null }>;
}) {
  const init = (): Record<string, Edit> =>
    Object.fromEntries(symbols.map((s) => {
      const r = rows.find((x) => x.symbol === s);
      return [s, { bias: r?.potential_bias ?? 'NONE', risk: String(r?.potential_risk ?? 0), reward: String(r?.potential_reward ?? 0),
        months: String(r?.estimated_position_duration ?? 0), ratio: r?.potential_risk_reward_ratio ?? '1:1', date: r?.date ?? '' }];
    }));
  const [edits, setEdits] = useState(init);
  const [orig, setOrig] = useState(init);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const upd = (s: string, p: Partial<Edit>) =>
    setEdits((cur) => {
      const n = { ...cur[s], ...p };
      const r = ratio(parseFloat(n.risk), parseFloat(n.reward));
      if (r) n.ratio = r;
      return { ...cur, [s]: n };
    });
  const changed = symbols.filter((s) => JSON.stringify({ ...edits[s], date: '' }) !== JSON.stringify({ ...orig[s], date: '' }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const d = today();
    const res = await saveRiskRewardAction(changed.map((s) => ({
      symbol: s, date: d, potential_bias: edits[s].bias, potential_risk: Number(edits[s].risk) || 0, potential_reward: Number(edits[s].reward) || 0,
      potential_risk_reward_ratio: edits[s].ratio, estimated_position_duration: Number(edits[s].months) || 0,
    })));
    setBusy(false);
    if (res.ok) {
      const next = Object.fromEntries(symbols.map((s) => [s, changed.includes(s) ? { ...edits[s], date: d } : edits[s]]));
      setEdits(next);
      setOrig(next);
      setMsg({ ok: true, text: `Saved ${changed.length} row${changed.length === 1 ? '' : 's'}, dated ${d}.` });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-fg-3">
            <tr>
              {['Symbol', 'Grade / reading', 'Bias', 'Risk %', 'Reward %', 'Ratio', 'Months', 'Last saved'].map((h) => (
                <th key={h} className="py-1 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((s) => {
              const e = edits[s];
              const rd = readings[s];
              return (
                <tr key={s} className={`border-t border-line ${changed.includes(s) ? 'bg-accent/5' : ''}`}>
                  <td className="py-1 font-semibold">{s}</td>
                  <td className="py-1 text-xs text-fg-2"><span className="inline-flex items-center gap-1"><GradeChip grade={rd?.grade ?? null} className="h-5 min-w-7 text-[10px]" />{rd?.label}</span></td>
                  <td className="py-1">
                    <select className={cell} value={e.bias} onChange={(x) => upd(s, { bias: x.target.value as Bias })}>
                      <option value="NONE">none</option><option value="LONG">long</option><option value="SHORT">short</option>
                    </select>
                  </td>
                  <td className="py-1"><input className={`${cell} w-16`} type="number" step="any" value={e.risk} onChange={(x) => upd(s, { risk: x.target.value })} /></td>
                  <td className="py-1"><input className={`${cell} w-16`} type="number" step="any" value={e.reward} onChange={(x) => upd(s, { reward: x.target.value })} /></td>
                  <td className="num py-1 text-xs">{e.ratio}</td>
                  <td className="py-1"><input className={`${cell} w-14`} type="number" step="any" value={e.months} onChange={(x) => upd(s, { months: x.target.value })} /></td>
                  <td className="num py-1 text-xs text-fg-3">{e.date || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={busy || !changed.length}>{busy ? 'Saving...' : `Save ${changed.length || ''} change${changed.length === 1 ? '' : 's'}`}</Button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-positive' : 'text-negative'}`}>{msg.text}</span>}
        <span className="ml-auto text-[11px] text-fg-3">Ratio is worked out from risk and reward (rounded up, reduced). Saving writes a row dated today; earlier rows are kept.</span>
      </div>
    </div>
  );
}
