'use client';

import { Input, Select } from '@/components/ui';
import { INDICATORS, type EdgeRule, type EdgeSet } from './edge-set';
import { GraphEdgeForm } from './graph-edge-form';

const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';

/** Edit the asset, period, outcome and the edge rules (shared by Edge Lab and Kelly). */
export function EdgeForm({ set, onChange }: { set: EdgeSet; onChange: (s: EdgeSet) => void }) {
  const upd = (p: Partial<EdgeSet>) => onChange({ ...set, ...p });
  const updRule = (i: number, p: Partial<EdgeRule>) => upd({ rules: set.rules.map((r, k) => (k === i ? { ...r, ...p } : r)) });
  const lbl = 'mb-1 block text-xs font-medium text-fg-2';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <div>
          <label className={lbl}>Asset (outcome)</label>
          <Input value={set.asset} onChange={(e) => upd({ asset: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className={lbl}>Bars</label>
          <Select value={set.timeframe} onChange={(e) => upd({ timeframe: e.target.value as EdgeSet['timeframe'] })}>
            <option value="1D">daily</option>
            <option value="1W">weekly</option>
            <option value="1M">monthly</option>
          </Select>
        </div>
        <div>
          <label className={lbl}>Start</label>
          <Input type="date" value={set.start} onChange={(e) => upd({ start: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>End</label>
          <Input type="date" value={set.end} onChange={(e) => upd({ end: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Win = up after (bars)</label>
          <Input type="number" min={1} value={set.horizon} onChange={(e) => upd({ horizon: Math.max(1, Number(e.target.value)) })} />
        </div>
        <div>
          <label className={lbl}>Side</label>
          <Select value={set.direction} onChange={(e) => upd({ direction: e.target.value as EdgeSet['direction'] })}>
            <option value="long">long (price rises)</option>
            <option value="short">short (price falls)</option>
          </Select>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead className="text-fg-3">
          <tr>
            <th className="p-1 text-left font-medium">Edge name</th>
            <th className="p-1 text-left font-medium">Series</th>
            <th className="p-1 text-left font-medium">Measure</th>
            <th className="p-1 text-left font-medium">Period</th>
            <th className="p-1 text-left font-medium">Condition</th>
            <th className="p-1" />
          </tr>
        </thead>
        <tbody>
          {set.rules.map((r, i) => {
            const ind = INDICATORS[r.indicator];
            return (
              <tr key={i} className="border-t border-line">
                <td className="p-1"><input className={`${cell} w-44`} value={r.name} onChange={(e) => updRule(i, { name: e.target.value })} /></td>
                <td className="p-1"><input className={`${cell} w-36`} value={r.symbol} onChange={(e) => updRule(i, { symbol: e.target.value.toUpperCase() })} /></td>
                <td className="p-1">
                  <select className={cell} value={r.indicator} onChange={(e) => updRule(i, { indicator: e.target.value as EdgeRule['indicator'] })}>
                    {Object.entries(INDICATORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </td>
                <td className="p-1">
                  {ind.hasPeriod && <input type="number" min={1} className={`${cell} w-16`} value={r.period} onChange={(e) => updRule(i, { period: Number(e.target.value) })} />}
                </td>
                <td className="p-1">
                  <select className={cell} value={r.op} onChange={(e) => updRule(i, { op: e.target.value as EdgeRule['op'] })}>
                    <option value="lt">{ind.hasValue ? 'below' : 'below average'}</option>
                    <option value="gt">{ind.hasValue ? 'above' : 'above average'}</option>
                  </select>
                  {ind.hasValue && <input type="number" step="any" className={`${cell} ml-1 w-20`} value={r.value} onChange={(e) => updRule(i, { value: Number(e.target.value) })} />}
                </td>
                <td className="p-1 text-right">
                  <button className="text-fg-3 hover:text-negative" title="Remove" onClick={() => upd({ rules: set.rules.filter((_, k) => k !== i) })}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        className="text-xs text-accent hover:underline"
        onClick={() => upd({ rules: [...set.rules, { name: `edge ${set.rules.length + 1}`, symbol: set.asset, indicator: 'rsi', period: 14, op: 'lt', value: 30 }] })}
      >
        + add edge
      </button>
      <div className="border-t border-line pt-3">
        <h3 className="mb-1 text-xs font-semibold text-fg-2">Edges from saved graphs</h3>
        <GraphEdgeForm set={set} onChange={onChange} />
      </div>
    </div>
  );
}
