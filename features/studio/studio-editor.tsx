'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Palette, { DRAG_MIME } from './palette';
import EngineNodeView from './engine-node';
import SchemaForm from './schema-form';
import { ApiError, engineApi, type PreviewResult } from './api';
import { StrategyResult } from './results';
import { flowToGraph, graphToFlow } from './convert';
import {
  TIMEFRAMES,
  WEEK_ANCHORS,
  dtypeCompatible,
  inHandle,
  outHandle,
  portOf,
  type BlockSpec,
  type EngineEdge,
  type EngineNode,
  type GraphJson,
  type GraphMeta,
  type Issue,
} from './types';

const nodeTypes = { engine: EngineNodeView };

const EMPTY_CLOCK: GraphJson['clock'] = { timeframe: '1W', anchor: 'FRI' };

type Tab = 'props' | 'issues' | 'run';
type Notice = { kind: 'ok' | 'error' | 'info'; text: string } | null;

function EditorInner({ legacyPipelines = [], initialGraphId, onSaved }: StudioEditorProps) {
  const [blocks, setBlocks] = useState<BlockSpec[]>([]);
  const [blocksError, setBlocksError] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<EngineNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EngineEdge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('props');

  const [name, setName] = useState('untitled');
  const [graphId, setGraphId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [legacyName, setLegacyName] = useState<string | null>(null);
  const [clock, setClock] = useState<GraphJson['clock']>(EMPTY_CLOCK);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState<GraphMeta[]>([]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [validMsg, setValidMsg] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState('');

  const [runStart, setRunStart] = useState('2020-01-01');
  const [runEnd, setRunEnd] = useState('2024-12-31');
  const [barsText, setBarsText] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [resultsOpen, setResultsOpen] = useState(true);
  const [resultIdx, setResultIdx] = useState(0);

  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const catalogue = useMemo(() => new Map(blocks.map((b) => [b.type, b])), [blocks]);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // ---- initial load -------------------------------------------------------------------------
  const loadBlocks = useCallback(async () => {
    setBlocksError('');
    try {
      setBlocks(await engineApi.blocks());
    } catch (e) {
      setBlocks([]);
      setBlocksError((e as Error).message);
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      setSaved(await engineApi.list());
    } catch {
      setSaved([]);
    }
  }, []);

  useEffect(() => {
    void loadBlocks();
    void refreshSaved();
  }, [loadBlocks, refreshSaved]);

  const initialLoaded = useRef(false);
  useEffect(() => {
    if (!initialGraphId || initialLoaded.current || blocks.length === 0) return;
    initialLoaded.current = true;
    void open(initialGraphId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGraphId, blocks.length]);

  const say = (kind: 'ok' | 'error' | 'info', text: string) => setNotice({ kind, text });

  // ---- graph <-> state ----------------------------------------------------------------------
  const currentGraph = useCallback(
    (): GraphJson => flowToGraph(nodes, edges, { name, clock, outputs, meta }),
    [nodes, edges, name, clock, outputs, meta],
  );

  const loadGraph = useCallback(
    (g: GraphJson, opts: { id?: string | null; name?: string; symbol?: string | null; legacy?: string | null }) => {
      const f = graphToFlow(g, catalogue);
      setNodes(f.nodes);
      setEdges(f.edges);
      setClock(g.clock ?? EMPTY_CLOCK);
      setOutputs(g.outputs ?? []);
      setMeta(g.meta ?? {});
      setGraphId(opts.id ?? null);
      setVersion(null);
      setName(opts.name ?? g.name ?? 'untitled');
      setSymbol(opts.symbol ?? null);
      setLegacyName(opts.legacy ?? (typeof g.meta?.legacy_pipeline === 'string' ? (g.meta.legacy_pipeline as string) : null));
      setIssues([]);
      setValidMsg('');
      setPreview(null);
      setSelectedId(null);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [catalogue, setNodes, setEdges, fitView],
  );

  // ---- canvas -------------------------------------------------------------------------------
  const newNodeId = useCallback(
    (type: string) => {
      const base = (type.split('.').pop() ?? 'node').replace(/[^A-Za-z0-9_]/g, '_');
      const used = new Set(nodes.map((n) => n.id));
      let id = base;
      for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
      return id;
    },
    [nodes],
  );

  const addBlock = useCallback(
    (spec: BlockSpec, at?: { x: number; y: number }) => {
      const pos = at ?? { x: 80 + (nodes.length % 5) * 40, y: 80 + (nodes.length % 5) * 40 };
      const id = newNodeId(spec.type);
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: 'engine',
          position: pos,
          data: { blockType: spec.type, spec, params: { ...(spec.example_params ?? {}) }, ui: {} },
        },
      ]);
      setSelectedId(id);
      setTab('props');
    },
    [nodes.length, newNodeId, setNodes],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DRAG_MIME);
      const spec = catalogue.get(type);
      if (!spec) return;
      addBlock(spec, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [catalogue, addBlock, screenToFlowPosition],
  );

  const reaches = useCallback((from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === to) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const e of edgesRef.current) if (e.source === cur) stack.push(e.target);
    }
    return false;
  }, []);

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      if (!c.source || !c.target || c.source === c.target) return false;
      const s = nodes.find((n) => n.id === c.source);
      const t = nodes.find((n) => n.id === c.target);
      if (!s || !t) return false;
      const sp = s.data.spec.outputs[portOf(c.sourceHandle)];
      const tp = t.data.spec.inputs[portOf(c.targetHandle)];
      if (!sp || !tp) return false;
      if (!dtypeCompatible(sp.dtype, tp.dtype)) return false;
      if (reaches(c.target, c.source)) return false; // would create a cycle
      return true;
    },
    [nodes, reaches],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const t = nodes.find((n) => n.id === c.target);
      const tp = t?.data.spec.inputs[portOf(c.targetHandle)];
      setEdges((es) => {
        // a non-variadic input takes one edge: the new one replaces the old one
        const kept = tp?.variadic ? es : es.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle));
        return addEdge({ ...c, id: `${c.source}.${portOf(c.sourceHandle)}->${c.target}.${portOf(c.targetHandle)}` }, kept);
      });
    },
    [nodes, setEdges],
  );

  // ---- selection / properties -----------------------------------------------------------------
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const updateParams = (id: string, params: Record<string, unknown>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, params } } : n)));

  const renameNode = (oldId: string, newId: string): string | null => {
    if (!newId || newId.includes('.') || /\s/.test(newId)) return "id must be non-empty with no '.' or spaces";
    if (newId !== oldId && nodes.some((n) => n.id === newId)) return 'id already in use';
    if (newId === oldId) return null;
    setNodes((ns) => ns.map((n) => (n.id === oldId ? { ...n, id: newId } : n)));
    setEdges((es) =>
      es.map((e) => {
        const source = e.source === oldId ? newId : e.source;
        const target = e.target === oldId ? newId : e.target;
        return { ...e, source, target, id: `${source}.${portOf(e.sourceHandle)}->${target}.${portOf(e.targetHandle)}` };
      }),
    );
    setOutputs((os) => os.map((o) => (o.startsWith(`${oldId}.`) ? `${newId}.${o.slice(oldId.length + 1)}` : o)));
    setSelectedId(newId);
    return null;
  };

  const toggleOutput = (ref: string) => setOutputs((os) => (os.includes(ref) ? os.filter((o) => o !== ref) : [...os, ref]));

  // ---- issues on nodes -----------------------------------------------------------------------
  const issuesByNode = useMemo(() => {
    const m = new Map<string, Issue[]>();
    for (const i of issues) {
      if (!i.node) continue;
      if (!m.has(i.node)) m.set(i.node, []);
      m.get(i.node)!.push(i);
    }
    return m;
  }, [issues]);

  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, issues: issuesByNode.get(n.id) } })),
    [nodes, issuesByNode],
  );

  // ---- actions --------------------------------------------------------------------------------
  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      say('error', e instanceof ApiError ? `${label}: ${e.message}` : `${label}: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  };

  const validate = () =>
    guard('Validate', async () => {
      const r = await engineApi.validate(currentGraph());
      setIssues(r.issues);
      const errs = r.issues.filter((i) => i.level === 'error').length;
      setValidMsg(r.valid ? `valid${r.issues.length ? ` (${r.issues.length} warning(s))` : ''}` : `${errs} error(s)`);
      setTab('issues');
      say(r.valid ? 'ok' : 'error', r.valid ? 'Graph is valid.' : `Graph has ${errs} error(s).`);
    });

  const save = () =>
    guard('Save', async () => {
      const graph = currentGraph();
      const payload = { name, graph, symbol, legacy_pipeline: legacyName };
      const rec = graphId ? await engineApi.update(graphId, payload) : await engineApi.create(payload);
      const created = !graphId;
      setGraphId(rec.id);
      const before = version;
      setVersion(rec.current_version ?? null);
      onSaved?.(rec.id, created);
      say(
        'ok',
        rec.current_version && rec.current_version !== before
          ? `Saved "${rec.name}" as version ${rec.current_version}.`
          : `Saved "${rec.name}" (graph unchanged, still version ${rec.current_version ?? 1}).`,
      );
      void refreshSaved();
    });

  const open = (id: string) =>
    guard('Load', async () => {
      const rec = await engineApi.get(id);
      loadGraph(rec.graph, { id: rec.id, name: rec.name, symbol: rec.symbol, legacy: rec.legacy_pipeline });
      setVersion(rec.current_version ?? null);
      say('info', `Loaded "${rec.name}"${rec.current_version ? ` (version ${rec.current_version})` : ''}.`);
    });

  const removeSaved = () =>
    guard('Delete', async () => {
      if (!graphId) return;
      if (!window.confirm(`Delete saved graph "${name}"?`)) return;
      await engineApi.remove(graphId);
      setGraphId(null);
      say('ok', 'Deleted. The canvas still holds the graph; Save creates it again.');
      void refreshSaved();
    });

  const importLegacy = (pipeline: string) =>
    guard('Import', async () => {
      const r = await engineApi.convertLegacy(pipeline);
      loadGraph(r.graph, { id: null, name: `${r.name}-graph`, symbol: r.symbol, legacy: pipeline });
      say('info', `Imported legacy pipeline "${pipeline}" (not saved yet).`);
    });

  const newGraph = () => {
    setNodes([]);
    setEdges([]);
    setClock(EMPTY_CLOCK);
    setOutputs([]);
    setMeta({});
    setGraphId(null);
    setName('untitled');
    setSymbol(null);
    setLegacyName(null);
    setIssues([]);
    setValidMsg('');
    setPreview(null);
    setSelectedId(null);
  };

  const runPreview = () =>
    guard('Run preview', async () => {
      setPreview(null);
      setPreviewError('');
      let bars: unknown;
      if (barsText.trim()) {
        try {
          bars = JSON.parse(barsText);
        } catch (e) {
          setPreviewError(`Bars JSON is invalid: ${(e as Error).message}`);
          return;
        }
      }
      try {
        const r = await engineApi.runPreview({ graph: currentGraph(), start: runStart, end: runEnd, bars });
        setPreview(r);
        setResultIdx(0);
        setResultsOpen(true);
        if (r.warnings?.length) setIssues((cur) => [...cur.filter((i) => i.level !== 'warning'), ...r.warnings]);
      } catch (e) {
        if (e instanceof ApiError && e.status === 501) {
          setPreviewError(`Not available yet: ${e.message}. Paste bars below ({"SYMBOL": [{"ts": "2024-01-05", "close": 1.0}, ...]}) to run on posted data.`);
        } else if (e instanceof ApiError && e.status === 422) {
          const d = (e.body as { detail?: { issues?: Issue[] } } | null)?.detail;
          if (d && typeof d === 'object' && Array.isArray(d.issues)) {
            setIssues(d.issues);
            setPreviewError('The graph failed validation; see Issues.');
          } else setPreviewError(e.message);
        } else throw e;
      }
    });

  const queueBacktest = () =>
    guard('Queue backtest', async () => {
      if (!graphId) return say('info', 'Save the graph first: a full backtest runs the saved version.');
      const r = await engineApi.queueRun({ graph_id: graphId, start: runStart, end: runEnd });
      say('ok', 'Backtest queued. Opening it in a new tab.');
      window.open(`/studio/runs/${r.id}`, '_blank');
    });

  // ---- render ----------------------------------------------------------------------------------
  const btn = 'rounded border border-line-2 bg-raised px-2 py-1 text-xs font-medium text-fg hover:bg-line disabled:opacity-50';
  const btnPrimary = 'rounded bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-50';
  const noticeCls = notice?.kind === 'error' ? 'bg-negative/10 text-negative' : notice?.kind === 'ok' ? 'bg-positive/10 text-positive' : 'bg-info/10 text-info';
  const errCount = issues.filter((i) => i.level === 'error').length;

  return (
    <div className="flex h-full min-h-[560px] p-3 flex-col gap-2">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-44 rounded border border-line-2 bg-bg text-fg px-2 py-1 text-sm" title="Graph name" />
        <input
          value={symbol ?? ''}
          onChange={(e) => setSymbol(e.target.value || null)}
          placeholder="symbol (optional)"
          className="w-32 rounded border border-line-2 bg-bg text-fg px-2 py-1 text-xs"
        />
        <button className={btnPrimary} onClick={save} disabled={!!busy || !name.trim() || nodes.length === 0}>
          {graphId ? 'Save' : 'Save new'}
        </button>
        {graphId && version !== null && (
          <span className="rounded-chip bg-line px-2 py-0.5 text-[11px] text-fg-2" title="Each save that changes the graph adds a version; runs record the version they used">
            v{version}
          </span>
        )}
        <select
          className="rounded border border-line-2 bg-bg text-fg px-1 py-1 text-xs"
          value=""
          onChange={(e) => e.target.value && open(e.target.value)}
          disabled={blocks.length === 0}
        >
          <option value="">Load saved ({saved.length})...</option>
          {saved.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.symbol ? ` [${g.symbol}]` : ''}
            </option>
          ))}
        </select>
        <button className={btn} onClick={removeSaved} disabled={!graphId || !!busy}>
          Delete saved
        </button>
        <button className={btn} onClick={newGraph}>
          New
        </button>
        <span className="mx-1 h-5 border-l border-line-2" />
        <LegacyPicker pipelines={legacyPipelines} disabled={!!busy || blocks.length === 0} onImport={importLegacy} />
        <span className="mx-1 h-5 border-l border-line-2" />
        <button className={btnPrimary} onClick={validate} disabled={!!busy || nodes.length === 0}>
          Validate
        </button>
        {validMsg && <span className={`text-xs ${errCount ? 'text-negative' : 'text-positive'}`}>{validMsg}</span>}
      </div>
      {(notice || busy) && (
        <div className={`rounded px-3 py-1 text-xs ${busy ? 'bg-raised text-fg' : noticeCls}`}>{busy ? `${busy}...` : notice?.text}</div>
      )}

      <div className="flex min-h-0 flex-1 gap-2">
        {/* palette */}
        <aside className="w-60 shrink-0 rounded-md border border-line bg-surface p-2">
          {blocksError ? (
            <div className="text-xs text-negative">
              <p className="font-semibold">Could not load the block catalogue.</p>
              <p className="mt-1 break-words">{blocksError}</p>
              <button className={`${btn} mt-2`} onClick={() => loadBlocks()}>
                Retry
              </button>
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-xs text-fg-3">Loading blocks...</p>
          ) : (
            <Palette blocks={blocks} onAdd={(b) => addBlock(b)} />
          )}
        </aside>

        {/* canvas */}
        <div ref={wrapper} className="min-w-0 flex-1 rounded-md border border-line bg-bg">
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onSelectionChange={({ nodes: sel }) => setSelectedId(sel.length === 1 ? sel[0].id : null)}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            minZoom={0.2}
            defaultEdgeOptions={{ style: { strokeWidth: 1.5 } }}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {/* right panel */}
        <aside className="flex w-80 shrink-0 flex-col rounded-md border border-line bg-surface">
          <div className="flex border-b border-line text-xs">
            {(['props', 'issues', 'run'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 font-medium ${tab === t ? 'border-b-2 border-accent text-fg' : 'text-fg-2 hover:bg-line'}`}
              >
                {t === 'props' ? 'Properties' : t === 'issues' ? `Issues${issues.length ? ` (${issues.length})` : ''}` : 'Run preview'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'props' && (
              <PropsPanel
                selected={selected}
                clock={clock}
                setClock={setClock}
                outputs={outputs}
                toggleOutput={toggleOutput}
                updateParams={updateParams}
                renameNode={renameNode}
                nodeCount={nodes.length}
              />
            )}
            {tab === 'issues' && (
              <IssuesPanel
                issues={issues}
                onPick={(id) => {
                  if (id && nodes.some((n) => n.id === id)) {
                    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
                    setSelectedId(id);
                  }
                }}
              />
            )}
            {tab === 'run' && (
              <RunPanel
                onQueue={queueBacktest}
                canQueue={!!graphId}
                start={runStart}
                end={runEnd}
                setStart={setRunStart}
                setEnd={setRunEnd}
                barsText={barsText}
                setBarsText={setBarsText}
                onRun={runPreview}
                busy={!!busy}
                disabled={nodes.length === 0}
                result={preview}
                error={previewError}
              />
            )}
          </div>
        </aside>
      </div>

      {/* strategy results of the last preview */}
      {preview?.strategies && preview.strategies.length > 0 && (
        <section className="shrink-0 rounded-md border border-line bg-surface">
          <header className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs">
            <button className="font-semibold text-fg" onClick={() => setResultsOpen((o) => !o)}>
              {resultsOpen ? '▾' : '▸'} Backtest results
            </button>
            <span className="text-fg-3">
              {runStart} to {runEnd} · preview, not saved
            </span>
            {preview.strategies.length > 1 && (
              <select className="ml-2 rounded border border-line-2 bg-bg px-1 py-0.5" value={resultIdx} onChange={(e) => setResultIdx(Number(e.target.value))}>
                {preview.strategies.map((s, k) => (
                  <option key={s.node} value={k}>{s.node}</option>
                ))}
              </select>
            )}
            <button className="ml-auto text-fg-3 hover:text-fg" onClick={() => setPreview(null)} title="Close results">
              ✕
            </button>
          </header>
          {resultsOpen && (
            <div className="max-h-[52vh] overflow-y-auto p-3">
              <StrategyResult report={preview.strategies[Math.min(resultIdx, preview.strategies.length - 1)]} chartHeight={240} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function LegacyPicker({ pipelines, disabled, onImport }: { pipelines: string[]; disabled: boolean; onImport: (name: string) => void }) {
  const [pick, setPick] = useState('');
  return (
    <div className="flex items-center gap-1">
      {pipelines.length > 0 ? (
        <select className="max-w-44 rounded border border-line-2 bg-bg text-fg px-1 py-1 text-xs" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Legacy pipeline...</option>
          {pipelines.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="w-36 rounded border border-line-2 bg-bg text-fg px-2 py-1 text-xs"
          placeholder="legacy pipeline name"
          value={pick}
          onChange={(e) => setPick(e.target.value)}
        />
      )}
      <button
        className="rounded border border-line-2 bg-bg text-fg bg-surface px-2 py-1 text-xs font-medium text-fg hover:bg-line disabled:opacity-50"
        disabled={disabled || !pick}
        onClick={() => onImport(pick)}
      >
        Import legacy
      </button>
    </div>
  );
}

function PropsPanel({
  selected,
  clock,
  setClock,
  outputs,
  toggleOutput,
  updateParams,
  renameNode,
  nodeCount,
}: {
  selected: EngineNode | null;
  clock: GraphJson['clock'];
  setClock: (c: GraphJson['clock']) => void;
  outputs: string[];
  toggleOutput: (ref: string) => void;
  updateParams: (id: string, p: Record<string, unknown>) => void;
  renameNode: (oldId: string, newId: string) => string | null;
  nodeCount: number;
}) {
  const [idDraft, setIdDraft] = useState('');
  const [idErr, setIdErr] = useState('');
  useEffect(() => {
    setIdDraft(selected?.id ?? '');
    setIdErr('');
  }, [selected?.id]);

  return (
    <div className="space-y-4 text-xs">
      <section>
        <h3 className="mb-1 font-semibold text-fg">Graph clock</h3>
        <div className="flex gap-2">
          <select
            className="rounded border border-line-2 bg-bg text-fg px-1 py-1"
            value={clock.timeframe}
            onChange={(e) => setClock({ timeframe: e.target.value, anchor: e.target.value === '1W' ? clock.anchor ?? 'FRI' : null })}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          {clock.timeframe === '1W' && (
            <select className="rounded border border-line-2 bg-bg text-fg px-1 py-1" value={clock.anchor ?? 'FRI'} onChange={(e) => setClock({ ...clock, anchor: e.target.value })}>
              {WEEK_ANCHORS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          )}
        </div>
      </section>

      {!selected ? (
        <p className="text-fg-3">
          {nodeCount === 0
            ? 'Drag a block from the palette onto the canvas (or double-click it) to start.'
            : 'Select a node to edit its parameters.'}
        </p>
      ) : (
        <>
          <section>
            <h3 className="font-semibold text-fg">{selected.data.spec.label}</h3>
            <p className="text-[10px] text-fg-3">{selected.data.blockType}</p>
            {selected.data.spec.description && <p className="mt-1 text-fg-2">{selected.data.spec.description}</p>}
            {selected.data.spec.timeframes && <p className="mt-1 text-[10px] text-fg-3">Timeframes: {selected.data.spec.timeframes.join(', ')}</p>}
            <label className="mt-2 block font-medium text-fg">Node id</label>
            <input
              className="w-full rounded border border-line-2 bg-bg text-fg px-2 py-1"
              value={idDraft}
              onChange={(e) => setIdDraft(e.target.value)}
              onBlur={() => setIdErr(renameNode(selected.id, idDraft.trim()) ?? '')}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            {idErr && <p className="text-[10px] text-negative">{idErr}</p>}
          </section>

          <section>
            <h3 className="mb-1 font-semibold text-fg">Parameters</h3>
            <SchemaForm
              key={selected.id}
              schema={selected.data.spec.params}
              values={selected.data.params}
              onChange={(p) => updateParams(selected.id, p)}
            />
          </section>

          {Object.keys(selected.data.spec.outputs).length > 0 && (
            <section>
              <h3 className="mb-1 font-semibold text-fg">Graph outputs</h3>
              {Object.entries(selected.data.spec.outputs).map(([port, p]) => {
                const ref = `${selected.id}.${port}`;
                return (
                  <label key={port} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={outputs.includes(ref)} onChange={() => toggleOutput(ref)} />
                    <span>{port}</span>
                    <span className="text-[10px] text-fg-3">{p.dtype}</span>
                  </label>
                );
              })}
              <p className="mt-1 text-[10px] text-fg-3">With none selected the engine returns every output.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function IssuesPanel({ issues, onPick }: { issues: Issue[]; onPick: (nodeId: string | null) => void }) {
  if (issues.length === 0) return <p className="text-xs text-fg-3">No issues. Press Validate to check the graph.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {issues.map((i, k) => (
        <li key={k}>
          <button
            onClick={() => onPick(i.node)}
            className={`w-full rounded border px-2 py-1 text-left ${i.level === 'error' ? 'border-negative/30 bg-negative/10 text-negative' : 'border-warning/30 bg-warning/10 text-warning'}`}
          >
            <span className="font-semibold">
              {i.node ?? 'graph'}
              {i.port ? `.${i.port}` : ''}
            </span>{' '}
            {i.message}
          </button>
        </li>
      ))}
    </ul>
  );
}

function RunPanel({
  start,
  end,
  setStart,
  setEnd,
  barsText,
  setBarsText,
  onRun,
  onQueue,
  canQueue,
  busy,
  disabled,
  result,
  error,
}: {
  onQueue: () => void;
  canQueue: boolean;
  start: string;
  end: string;
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
  barsText: string;
  setBarsText: (v: string) => void;
  onRun: () => void;
  busy: boolean;
  disabled: boolean;
  result: PreviewResult | null;
  error: string;
}) {
  const tail = result ? result.index.slice(-15) : [];
  const from = result ? result.index.length - tail.length : 0;
  return (
    <div className="space-y-3 text-xs">
      <div className="flex gap-2">
        <label className="flex-1">
          Start
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded border border-line-2 bg-bg text-fg px-1 py-1" />
        </label>
        <label className="flex-1">
          End
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded border border-line-2 bg-bg text-fg px-1 py-1" />
        </label>
      </div>
      <label className="block">
        Bars (optional JSON, symbol to rows)
        <textarea
          value={barsText}
          onChange={(e) => setBarsText(e.target.value)}
          rows={5}
          placeholder='{"GOLD": [{"ts": "2024-01-05", "close": 2040.5}]}'
          className="w-full rounded border border-line-2 bg-bg text-fg px-2 py-1 font-mono text-[11px]"
        />
      </label>
      <button className="rounded bg-accent px-3 py-1 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50" onClick={onRun} disabled={busy || disabled}>
        Run preview
      </button>
      <button
        className="ml-2 rounded border border-line-2 bg-raised px-3 py-1 font-medium text-fg hover:bg-line disabled:opacity-50"
        onClick={onQueue}
        disabled={busy || disabled}
        title={canQueue ? 'Queue a saved, full backtest (opens in a new tab)' : 'Save the graph first'}
      >
        Run full backtest
      </button>
      <p className="text-[10px] text-fg-3">
        Preview runs the graph on screen as it is now. Full backtest runs the last saved version in the background and keeps the result under Runs.
      </p>
      {result?.strategies && result.strategies.length > 0 && (
        <p className="rounded bg-info/10 p-2 text-info">Strategy results are shown below the canvas.</p>
      )}
      {error && <p className="rounded bg-warning/10 p-2 text-warning">{error}</p>}
      {result && (
        <div>
          <p className="mb-1 text-fg-2">
            {result.index.length} ticks, last {tail.length} shown.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-raised">
                  <th className="border px-1 text-left">ts</th>
                  {result.outputs.map((o) => (
                    <th key={o} className="border px-1 text-left">
                      {o}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tail.map((ts, k) => (
                  <tr key={ts}>
                    <td className="border px-1 whitespace-nowrap">{ts.slice(0, 10)}</td>
                    {result.outputs.map((o) => {
                      const v = result.values[o]?.[from + k];
                      return (
                        <td key={o} className="border px-1 text-right">
                          {v === null || v === undefined ? '-' : typeof v === 'number' ? Number(v.toFixed(4)) : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export interface StudioEditorProps {
  /** Legacy pipeline names for the import picker; empty -> free-text input. */
  legacyPipelines?: string[];
  /** Saved graph to open on mount. */
  initialGraphId?: string | null;
  /** Called after a successful save (id of the saved graph). */
  onSaved?: (id: string, created: boolean) => void;
}

export default function StudioEditor(props: StudioEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} legacyPipelines={props.legacyPipelines ?? []} />
    </ReactFlowProvider>
  );
}
