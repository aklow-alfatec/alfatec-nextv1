'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Segmented } from '@/components/ui';
import { engineApi, type StrategyReport } from '../studio/api';
import { buildPlot, equityFromReport, tradesFromReport, type AddedSeries, type GraphColumns } from './build';
import { PRESETS, initialLayout, layoutKey, parseLayout, presetLayout, resolveLayout, sameLayout, type ChartLayout, type PresetName } from './layout';
import { Picker } from './picker';
import type { ChartSource } from './sources';

// lightweight-charts is only loaded on pages that draw the chart
const MultiPaneChart = dynamic(() => import('./chart').then((m) => m.MultiPaneChart), {
  ssr: false,
  loading: () => <p className="py-10 text-center text-sm text-fg-3">Loading chart...</p>,
});

interface Props {
  source: ChartSource;
  report: StrategyReport | undefined;
  /** the graph whose meta.chart holds the saved layout; without it the layout is only kept in this browser */
  graphId?: string | null;
  /** from graph.meta.chart; read from the graph record when omitted */
  savedLayout?: unknown;
  /** after the layout was saved to the graph (the editor keeps its own copy of graph.meta) */
  onSaved?: (layout: ChartLayout) => void;
}

const readDraft = (graphId: string | null | undefined): ChartLayout | null => {
  if (!graphId) return null;
  try {
    const raw = window.localStorage.getItem(layoutKey(graphId));
    return raw ? parseLayout(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};
const writeDraft = (graphId: string, l: ChartLayout | null) => {
  try {
    if (l) window.localStorage.setItem(layoutKey(graphId), JSON.stringify(l));
    else window.localStorage.removeItem(layoutKey(graphId));
  } catch {
    /* private window: the layout still works for this visit */
  }
};

/** The backtest chart with its indicator picker: presets, per-graph saved layout, columns fetched as the layout needs them. */
export function RunChart({ source, report, graphId, savedLayout, onSaved }: Props) {
  const cat = source.catalogue;
  const priceRef = report?.price_ref;
  const [saved, setSaved] = useState<ChartLayout | null>(() => parseLayout(savedLayout));
  const [savedLoaded, setSavedLoaded] = useState(savedLayout !== undefined || !graphId);
  const [layout, setLayout] = useState<ChartLayout | null>(null);
  const [graphCols, setGraphCols] = useState<GraphColumns | null>(null);
  const [added, setAdded] = useState<Record<string, AddedSeries>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const loaded = useRef<Set<string>>(new Set());
  const asked = useRef<Set<string>>(new Set());

  // the saved layout lives in the graph record
  useEffect(() => {
    if (savedLoaded || !graphId) return;
    engineApi.get(graphId).then((g) => setSaved(parseLayout(g.graph?.meta?.chart))).catch(() => undefined).finally(() => setSavedLoaded(true));
  }, [graphId, savedLoaded]);

  // first layout: this browser's unsaved draft, else the graph's saved layout, else the Strategy preset
  useEffect(() => {
    if (!savedLoaded || layout) return;
    setLayout(readDraft(graphId) ?? initialLayout(saved, cat, priceRef));
  }, [savedLoaded, layout, saved, cat, priceRef, graphId]);

  const { present, missing } = useMemo(() => (layout ? resolveLayout(layout, cat) : { present: [], missing: [] }), [layout, cat]);

  // fetch what the layout shows and has not been fetched yet
  useEffect(() => {
    const refs = Array.from(new Set(present.filter((s) => s.ref).map((s) => s.ref as string))).filter((r) => !loaded.current.has(r) && !asked.current.has(r));
    const inds = present.filter((s) => s.indicator && !added[s.id] && !asked.current.has(s.id));
    if (!refs.length && !inds.length) return;
    refs.forEach((r) => asked.current.add(r));
    inds.forEach((s) => asked.current.add(s.id));
    let stop = false;
    setBusy(true);
    setError('');
    (async () => {
      try {
        const [cols, ind] = await Promise.all([
          refs.length ? source.loadColumns(refs) : Promise.resolve(null),
          inds.length && source.loadIndicators ? source.loadIndicators(inds.map((s) => ({ id: s.id, indicator: s.indicator! }))) : Promise.resolve(null),
        ]);
        if (stop) return;
        if (cols) {
          refs.forEach((r) => loaded.current.add(r));
          setGraphCols((g) => (g ? { t: g.t, cols: { ...g.cols, ...cols.cols } } : cols));
        }
        if (ind) setAdded((a) => ({ ...a, ...ind }));
      } catch (e) {
        if (!stop) {
          setError((e as Error).message);
          // let a changed layout retry these
          refs.forEach((r) => asked.current.delete(r));
          inds.forEach((s) => asked.current.delete(s.id));
        }
      } finally {
        if (!stop) setBusy(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [present, added, source]);

  const change = useCallback(
    (l: ChartLayout) => {
      setLayout(l);
      setNote('');
      if (graphId) writeDraft(graphId, sameLayout(l, saved ?? initialLayout(null, cat, priceRef)) ? null : l);
    },
    [graphId, saved, cat, priceRef],
  );

  const plot = useMemo(
    () => buildPlot(present, graphCols, added, (r) => cat.find((c) => c.ref === r)?.kind),
    [present, graphCols, added, cat],
  );
  const hasEquity = present.some((s) => s.special === 'equity');
  const hasTrades = present.some((s) => s.special === 'trades');
  const equity = useMemo(() => (hasEquity ? equityFromReport(report) : null), [hasEquity, report]);
  const trades = useMemo(() => (hasTrades ? tradesFromReport(report) : null), [hasTrades, report]);

  const baseline = saved ?? initialLayout(null, cat, priceRef);
  const dirty = !!layout && !sameLayout(layout, baseline);
  const save = async () => {
    if (!graphId || !layout) return;
    setNote('');
    try {
      // the graph's current record, so a graph edited since this page opened is not overwritten; meta.chart is not part of the graph hash
      const g = await engineApi.get(graphId);
      const meta = { ...(g.graph.meta ?? {}), chart: layout };
      const rec = await engineApi.update(graphId, { graph: { ...g.graph, meta } });
      setSaved(layout);
      writeDraft(graphId, null);
      onSaved?.(layout);
      setNote(rec.current_version === g.current_version ? 'Saved as the default for this graph (no new version).' : 'Saved.');
    } catch (e) {
      setNote(`Could not save: ${(e as Error).message}`);
    }
  };

  if (!layout) return <p className="py-6 text-center text-sm text-fg-3">Loading chart...</p>;
  const preset = layout.preset;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<PresetName | 'custom'>
          options={[...PRESETS.map((p) => ({ value: p.id as PresetName | 'custom', label: p.label })), ...(preset === 'custom' ? [{ value: 'custom' as const, label: 'Custom' }] : [])]}
          value={preset ?? 'custom'}
          onChange={(v) => v !== 'custom' && change(presetLayout(v, cat, priceRef))}
        />
        {busy && <span className="text-xs text-fg-3">Loading series...</span>}
        <span className="ml-auto flex items-center gap-2">
          {note && <span className="text-xs text-fg-2">{note}</span>}
          {dirty && <span className="text-xs text-fg-3">Not saved{graphId ? ' (kept in this browser)' : ''}</span>}
          {dirty && <Button size="sm" variant="ghost" onClick={() => change(baseline)}>Reset</Button>}
          {graphId && <Button size="sm" onClick={save} disabled={!dirty}>Save as default for this graph</Button>}
        </span>
      </div>
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[270px_minmax(0,1fr)]">
        <Picker catalogue={cat} layout={layout} onChange={change} priceRef={priceRef} canAdd={!!source.loadIndicators} missing={missing} />
        <div className="min-w-0">
          <Legend plot={plot} equity={hasEquity} />
          <MultiPaneChart series={plot} equity={equity} trades={trades} />
        </div>
      </div>
    </div>
  );
}

function Legend({ plot, equity }: { plot: { id: string; label: string; color: string }[]; equity: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2">
      {plot.map((s) => (
        <span key={s.id} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5" style={{ background: s.color }} />{s.label}</span>
      ))}
      {equity && <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5 bg-accent" />Strategy <i className="ml-2 inline-block h-0.5 w-3.5 bg-fg-3" />Buy and hold</span>}
    </div>
  );
}
