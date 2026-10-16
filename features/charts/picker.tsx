'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { engineApi, type SeriesInfo } from '../studio/api';
import type { BlockSpec } from '../studio/types';
import {
  INDICATOR_MENU,
  PANE_NAMES,
  allowedPanes,
  indicatorSeries,
  nextColor,
  paneForKind,
  type ChartLayout,
  type LayoutSeries,
  type MenuIndicator,
  type PaneKind,
} from './layout';

const field = 'h-7 rounded-control border border-line-2 bg-bg px-1.5 text-xs text-fg focus:border-accent focus:outline-none';

interface Props {
  catalogue: SeriesInfo[];
  layout: ChartLayout;
  onChange: (l: ChartLayout) => void;
  /** the strategy's price series, the default input of an added indicator */
  priceRef: string | null | undefined;
  /** false when the source cannot compute indicators (editor preview) */
  canAdd: boolean;
  missing: LayoutSeries[];
}

/** Blocks the "More..." menu offers: numeric inputs only, at least one numeric output, and not a data / strategy source. */
function moreBlocks(blocks: BlockSpec[]): BlockSpec[] {
  const num = (d: string) => d === 'float' || d === 'int' || d === 'bool';
  return blocks.filter((b) => {
    const ins = Object.values(b.inputs);
    return ins.length > 0 && ins.every((p) => num(p.dtype) && !p.variadic) && Object.values(b.outputs).some((p) => num(p.dtype))
      && !b.type.startsWith('data.') && !b.type.startsWith('strategy.');
  });
}

/** Default values of a block's numeric params (from its JSON schema). */
function numericParams(b: BlockSpec | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(b?.params?.properties ?? {})) {
    const t = Array.isArray(v.type) ? v.type[0] : v.type;
    if ((t === 'integer' || t === 'number') && typeof v.default === 'number') out[k] = v.default;
  }
  return Object.fromEntries(Object.entries(out).slice(0, 4));
}

export function Picker({ catalogue, layout, onChange, priceRef, canAdd, missing }: Props) {
  const [q, setQ] = useState('');
  const on = useMemo(() => new Map(layout.series.map((s) => [s.id, s])), [layout.series]);
  const groups = useMemo(() => {
    const f = q.trim().toLowerCase();
    const g = new Map<string, SeriesInfo[]>();
    for (const s of catalogue) {
      if (f && !`${s.ref} ${s.block_label} ${s.port}`.toLowerCase().includes(f)) continue;
      const key = `${s.node} · ${s.block_label}`;
      g.set(key, [...(g.get(key) ?? []), s]);
    }
    return [...g.entries()];
  }, [catalogue, q]);

  const edit = (series: LayoutSeries[]) => onChange({ ...layout, preset: 'custom', series });
  const toggle = (s: SeriesInfo) => {
    if (on.has(s.ref)) return edit(layout.series.filter((x) => x.id !== s.ref));
    // keep the equity pane last in the list: the chart orders panes itself, so just append
    edit([...layout.series, { id: s.ref, ref: s.ref, pane: paneForKind(s.kind), color: s.kind === 'price' ? '#a3b1c6' : nextColor(layout.series.map((x) => x.color)) }]);
  };
  const patch = (id: string, p: Partial<LayoutSeries>) => edit(layout.series.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const kindOf = (s: LayoutSeries) => (s.indicator ? 'indicator' : catalogue.find((c) => c.ref === s.ref)?.kind ?? 'other');
  const special = (kind: 'trades' | 'equity', label: string, pane: PaneKind) => {
    const id = `@${kind}`;
    const cur = on.get(id);
    return (
      <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-raised">
        <input
          type="checkbox"
          checked={!!cur}
          onChange={() => edit(cur ? layout.series.filter((x) => x.id !== id) : [...layout.series, { id, special: kind, label, pane, color: '#f2a93b' }])}
        />
        <span className="h-2.5 w-2.5 rounded-sm bg-accent" />
        <span>{label}</span>
      </label>
    );
  };

  const added = layout.series.filter((s) => s.indicator);
  const row = (s: LayoutSeries, title: string, sub: string) => (
    <div key={s.id} className="grid grid-cols-[16px_20px_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-raised">
      <input type="checkbox" checked readOnly onClick={() => edit(layout.series.filter((x) => x.id !== s.id))} aria-label={`Hide ${title}`} />
      <input type="color" value={s.color.startsWith('#') ? s.color : '#f2a93b'} onChange={(e) => patch(s.id, { color: e.target.value })} className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0" aria-label={`Colour of ${title}`} />
      <span className="min-w-0 truncate" title={sub}>{title}<span className="num ml-1 text-[10.5px] text-fg-3">{sub}</span></span>
      <select className={field} value={s.pane} onChange={(e) => patch(s.id, { pane: e.target.value as PaneKind })} aria-label={`Pane for ${title}`}>
        {Array.from(new Set([s.pane, ...allowedPanes(kindOf(s) as never)])).map((p) => <option key={p} value={p}>{PANE_NAMES[p]}</option>)}
      </select>
    </div>
  );

  return (
    <aside className="space-y-3 text-sm" aria-label="Indicators">
      <input className={`${field} w-full`} type="search" placeholder="Search indicators" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-0.5">
        {special('trades', 'Trades (entries / exits)', 'price')}
        {special('equity', 'Equity vs buy and hold', 'equity')}
      </div>
      {added.length > 0 && (
        <div className="space-y-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-3">Added <span className="font-normal normal-case">(computed for this run, not in the graph)</span></h3>
          {added.map((s) => row(s, s.label ?? s.indicator!.label, `on ${s.indicator!.input}`))}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-3">In this graph <span className="num font-normal">{catalogue.length} series</span></h3>
        <div className="max-h-80 space-y-2 overflow-auto pr-1">
          {groups.map(([name, items]) => (
            <div key={name}>
              <div className="truncate text-[11px] text-fg-3" title={name}>{name}</div>
              {items.map((s) => {
                const cur = on.get(s.ref);
                return cur && !cur.indicator ? (
                  row(cur, s.port, s.ref)
                ) : (
                  <label key={s.ref} className="grid cursor-pointer grid-cols-[16px_20px_minmax(0,1fr)] items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-raised">
                    <input type="checkbox" checked={false} onChange={() => toggle(s)} />
                    <span className="h-2.5 w-2.5 rounded-sm bg-line-2" />
                    <span className="min-w-0 truncate" title={s.ref}>{s.port}<span className="num ml-1 text-[10.5px] text-fg-3">{s.kind === 'other' ? '' : s.kind.replace('_', ' ')}</span></span>
                  </label>
                );
              })}
            </div>
          ))}
          {!groups.length && <p className="text-xs text-fg-3">Nothing matches.</p>}
        </div>
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] text-warning">Not in this run, skipped: {missing.map((m) => m.label ?? m.ref).join(', ')}</p>
      )}
      {canAdd ? (
        <AddIndicator catalogue={catalogue} priceRef={priceRef} layout={layout} onChange={onChange} />
      ) : (
        <p className="rounded border border-dashed border-line-2 p-2 text-[11px] text-fg-3">Indicators the graph does not contain can be added on a saved run.</p>
      )}
    </aside>
  );
}

function AddIndicator({ catalogue, priceRef, layout, onChange }: Pick<Props, 'catalogue' | 'priceRef' | 'layout' | 'onChange'>) {
  const [type, setType] = useState('rsi');
  const [params, setParams] = useState<Record<string, number>>({ ...INDICATOR_MENU[0].params });
  const [input, setInput] = useState(priceRef ?? '');
  const [blocks, setBlocks] = useState<BlockSpec[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => setInput((cur) => cur || priceRef || ''), [priceRef]);

  const choose = (id: string) => {
    setType(id);
    setErr('');
    if (id === '__more') {
      if (!blocks) engineApi.blocks().then((b) => setBlocks(moreBlocks(b))).catch((e: Error) => setErr(e.message));
      setParams({});
      return;
    }
    if (id.startsWith('block:')) {
      setParams(numericParams(blocks?.find((b) => b.type === id.slice(6))));
      return;
    }
    setParams({ ...(INDICATOR_MENU.find((m) => m.id === id)?.params ?? {}) });
  };
  const menu = INDICATOR_MENU.find((m) => m.id === type);
  const block = type.startsWith('block:') ? blocks?.find((b) => b.type === type.slice(6)) : undefined;
  const inputs = useMemo(() => catalogue.filter((s) => s.kind !== 'bool' && s.dtype !== 'bool'), [catalogue]);

  const add = () => {
    let m: MenuIndicator | null = menu ?? null;
    if (!m && block) {
      const outs = Object.entries(block.outputs).filter(([, p]) => p.dtype === 'float' || p.dtype === 'int').map(([k]) => k).slice(0, 4);
      m = { id: block.type, label: block.label, type: block.type, outputs: outs, pane: 'other', params: {}, short: block.label };
    }
    if (!m || !input) return;
    const params2 = { ...params };
    onChange({ ...layout, preset: 'custom', series: [...layout.series, ...indicatorSeries(m, params2, input, layout.series.map((s) => s.color)).filter((s) => !layout.series.some((x) => x.id === s.id))] });
  };

  return (
    <div className="space-y-1.5 rounded-card border border-dashed border-line-2 p-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-3">Add an indicator</h3>
      <div className="flex flex-wrap gap-1.5">
        <select className={field} value={type} onChange={(e) => choose(e.target.value)} aria-label="Indicator">
          {INDICATOR_MENU.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          <option value="__more">More...</option>
          {blocks?.map((b) => <option key={b.type} value={`block:${b.type}`}>{b.category} / {b.label}</option>)}
        </select>
        {Object.entries(params).map(([k, v]) => (
          <input key={k} className={`${field} w-16`} type="number" step="any" value={v} title={k} aria-label={k} onChange={(e) => setParams({ ...params, [k]: Number(e.target.value) })} />
        ))}
      </div>
      <select className={`${field} w-full`} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Applied to">
        {priceRef && <option value={priceRef}>Applied to {priceRef}</option>}
        {inputs.filter((s) => s.ref !== priceRef).map((s) => <option key={s.ref} value={s.ref}>Applied to {s.ref}</option>)}
      </select>
      <Button size="sm" onClick={add} disabled={!input || (type === '__more')}>Add to chart</Button>
      {err && <p className="text-[11px] text-negative">{err}</p>}
      <p className="text-[11px] text-fg-3">Computed for this run&apos;s period; nothing is saved in the graph.</p>
    </div>
  );
}
