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
import { RunChart } from '../charts/run-chart';
import { previewSource } from '../charts/sources';
import { StrategyResult } from './results';
import HistoryPanel from './history-panel';
import { flowToGraph, graphToFlow } from './convert';
import { applyRunParams, diffParams, isCapitalBlocks, sameGraph, type ParamDiff, type RunParams } from './run-params';
import { setRunNameAction } from '@/app/(app)/studio/runs/actions';
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
  type GraphRecord,
  type Issue,
} from './types';

const nodeTypes = { engine: EngineNodeView };

const EMPTY_CLOCK: GraphJson['clock'] = { timeframe: '1W', anchor: 'FRI' };

type Tab = 'props' | 'issues' | 'run' | 'history';
type Notice = { kind: 'ok' | 'error' | 'info'; text: string } | null;

function EditorInner({ legacyPipelines = [], initialGraphId, runId, onSaved }: StudioEditorProps) {
  const [blocks, setBlocks] = useState<BlockSpec[]>([]);
  const [blocksError, setBlocksError] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<EngineNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EngineEdge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('props');
  /** Set while the canvas shows a run's graph with that run's own settings filled in (read-only). */
  const [runView, setRunView] = useState<{ runId: string; label: string; params: RunParams | null } | null>(null);
  /** 'graph': edits change the graph (Save makes a version). 'run': edits are run settings on top of the saved
   *  graph; the graph's blocks and connections are locked and nothing is saved to it. */
  const [mode, setMode] = useState<'graph' | 'run'>('graph');
  /** The graph as last loaded from / saved to the server. */
  const [savedGraph, setSavedGraph] = useState<GraphJson | null>(null);
  /** What run settings are compared with: the saved graph (run mode) or the version a run used (run view). */
  const [runBase, setRunBase] = useState<GraphJson | null>(null);
  const [runName, setRunName] = useState('');

  const [name, setName] = useState('untitled');
  const [graphId, setGraphId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [saveNote, setSaveNote] = useState('');
  const [historyKey, setHistoryKey] = useState(0);
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
  // the preview already holds every series the graph computed: the chart reads its columns from it (no second run)
  const previewChart = useMemo(() => (preview ? previewSource(preview) : null), [preview]);
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
    void (runId ? openRunView(initialGraphId, runId) : open(initialGraphId));
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
      // back to editing the graph; openRunView / useRunSettings set these again after loading
      setRunView(null);
      setRunBase(null);
      setMode('graph');
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
      if (mode === 'run' || runView) return;
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
    [nodes.length, newNodeId, setNodes, mode, runView],
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
      if (mode === 'run' || runView) return;
      const t = nodes.find((n) => n.id === c.target);
      const tp = t?.data.spec.inputs[portOf(c.targetHandle)];
      setEdges((es) => {
        // a non-variadic input takes one edge: the new one replaces the old one
        const kept = tp?.variadic ? es : es.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle));
        return addEdge({ ...c, id: `${c.source}.${portOf(c.sourceHandle)}->${c.target}.${portOf(c.targetHandle)}` }, kept);
      });
    },
    [nodes, setEdges, mode, runView],
  );

  // ---- selection / properties -----------------------------------------------------------------
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const updateParams = (id: string, params: Record<string, unknown>) => {
    if (runView) return say('info', 'This shows a finished run: press "Use these settings" to change them for a new run.');
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, params } } : n)));
  };

  /** Run settings: put one setting of one block back to the saved graph's value. */
  const resetSetting = (node: string, key: string) => {
    const base = runBase?.nodes.find((n) => n.id === node)?.params ?? {};
    setNodes((ns) => ns.map((n) => {
      if (n.id !== node) return n;
      const params = { ...n.data.params };
      if (key in base) params[key] = structuredClone(base[key]);
      else delete params[key];
      return { ...n, data: { ...n.data, params } };
    }));
  };

  const renameNode = (oldId: string, newId: string): string | null => {
    if (newId !== oldId && (mode === 'run' || runView)) return 'block ids are locked while setting run settings';
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

  // run settings: every setting that differs from runBase (highlighted on the canvas and in Properties)
  const overrides = useMemo(
    () => (runBase ? diffParams(runBase, nodes.map((n) => ({ id: n.id, params: n.data.params }))) : { params: {}, byNode: {} }),
    [runBase, nodes],
  );
  const runOverrides = overrides.byNode;
  const locked = mode === 'run' || !!runView; // blocks and connections can't change

  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, issues: issuesByNode.get(n.id), overridden: runOverrides[n.id] ? Object.keys(runOverrides[n.id]) : undefined } })),
    [nodes, issuesByNode, runOverrides],
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
      const payload = { name, graph, symbol, legacy_pipeline: legacyName, ...(saveNote.trim() ? { note: saveNote.trim() } : {}) };
      const rec = graphId ? await engineApi.update(graphId, payload) : await engineApi.create(payload);
      const created = !graphId;
      setSavedGraph(graph);
      setGraphId(rec.id);
      const before = version;
      setVersion(rec.current_version ?? null);
      onSaved?.(rec.id, created);
      setSaveNote('');
      setHistoryKey((k) => k + 1);
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
      setSavedGraph(rec.graph);
      setVersion(rec.current_version ?? null);
      say('info', `Loaded "${rec.name}"${rec.current_version ? ` (version ${rec.current_version})` : ''}.`);
    });

  /** The graph version a run used, with the run's settings applied (read-only view). */
  const openRunView = (id: string, rid: string) =>
    guard('Load', async () => {
      const [rec, run] = await Promise.all([engineApi.get(id), engineApi.run(rid)]);
      let g = rec.graph;
      let vno = rec.current_version ?? null;
      if (run.graph_version_id) {
        const v = (await engineApi.versions(id)).find((x) => x.id === run.graph_version_id);
        if (v) {
          g = (await engineApi.version(id, v.version)).graph;
          vno = v.version;
        }
      }
      loadGraph(applyRunParams(g, run.params), { id: rec.id, name: rec.name, symbol: rec.symbol, legacy: rec.legacy_pipeline });
      setSavedGraph(rec.graph);
      setRunBase(g); // highlights what the run changed against the version it used
      setVersion(vno);
      const label = run.tags?.find((t) => t.startsWith('name:'))?.slice(5) || run.created_at?.slice(0, 16).replace('T', ' ') || rid.slice(0, 8);
      setRunView({ runId: rid, label, params: run.params });
      say('info', `Showing ${rec.name}${vno ? ` v${vno}` : ''} with the settings of run ${label}. Read-only: nothing here is saved.`);
    });

  const draftKey = (id: string) => `alfatec.runSettings.${id}`;
  const readDraft = (id: string): { params?: RunParams; name?: string } => {
    try {
      return JSON.parse(localStorage.getItem(draftKey(id)) ?? '{}');
    } catch {
      return {};
    }
  };

  /** Switch to run settings: edits from here on are settings for the next run, on top of the saved graph. */
  const enterRunMode = () => {
    if (!graphId || !savedGraph) return say('info', 'Save the graph first: run settings go on top of the saved graph.');
    if (!sameGraph(currentGraph(), savedGraph)) {
      return say('error', 'The graph has unsaved changes. Save them (Graph mode) or reload the graph before setting run settings.');
    }
    const d = readDraft(graphId);
    if (d.params && Object.keys(d.params).length) {
      const g = applyRunParams(savedGraph, d.params);
      const by = new Map(g.nodes.map((n) => [n.id, n.params]));
      setNodes((ns) => ns.map((n) => (by.has(n.id) ? { ...n, data: { ...n.data, params: { ...by.get(n.id)! } } } : n)));
    }
    if (d.name) setRunName(d.name);
    setRunBase(savedGraph);
    setMode('run');
    setTab('run');
    say('info', 'Run settings: changes apply to the next run only. The saved graph is not changed.');
  };

  /** Back to editing the graph: the canvas shows the saved settings again (the run settings stay as a draft). */
  const leaveRunMode = () => {
    if (runBase) {
      const by = new Map(runBase.nodes.map((n) => [n.id, n.params ?? {}]));
      setNodes((ns) => ns.map((n) => (by.has(n.id) ? { ...n, data: { ...n.data, params: structuredClone(by.get(n.id)!) } } : n)));
    }
    setRunBase(null);
    setMode('graph');
  };

  const clearRunSettings = () => {
    if (!runBase) return;
    const by = new Map(runBase.nodes.map((n) => [n.id, n.params ?? {}]));
    setNodes((ns) => ns.map((n) => (by.has(n.id) ? { ...n, data: { ...n.data, params: structuredClone(by.get(n.id)!) } } : n)));
    if (graphId) {
      try {
        localStorage.removeItem(draftKey(graphId));
      } catch {
        /* storage blocked: nothing kept anyway */
      }
    }
  };

  /** From a finished run's view: its settings become the starting point for a new run on the current saved graph. */
  const useRunSettings = () => {
    if (!runView || !savedGraph || !graphId) return;
    const { params, label } = runView;
    loadGraph(applyRunParams(savedGraph, params), { id: graphId, name, symbol, legacy: legacyName });
    setRunBase(savedGraph);
    setMode('run');
    setTab('run');
    setRunName(label);
    say('info', `Run settings copied from ${label}. Change them and run; the saved graph is not changed.`);
  };

  // keep the run settings and name as a draft in this browser, per graph
  useEffect(() => {
    if (mode !== 'run' || !graphId) return;
    try {
      localStorage.setItem(draftKey(graphId), JSON.stringify({ params: overrides.params, name: runName }));
    } catch {
      /* storage blocked: the draft just isn't kept */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, graphId, overrides, runName]);

  const openVersion = (g: GraphJson, n: number) => {
    const keep = version;
    loadGraph(g, { id: graphId, name, symbol, legacy: legacyName });
    setVersion(keep);
    setTab('history');
    say('info', `Opened version ${n} on the canvas (not saved). Save to make it the current version, or reload the graph to discard.`);
  };

  const restored = (rec: GraphRecord) => {
    loadGraph(rec.graph, { id: rec.id, name: rec.name, symbol: rec.symbol, legacy: rec.legacy_pipeline });
    setSavedGraph(rec.graph);
    setVersion(rec.current_version ?? null);
    setHistoryKey((k) => k + 1);
    say('ok', `Restored as version ${rec.current_version}.`);
  };

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
    setRunView(null);
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
      if (mode === 'graph' && savedGraph && !sameGraph(currentGraph(), savedGraph)) {
        return say('error', 'The graph has unsaved changes: a full backtest runs the saved version. Save first, or use Run settings.');
      }
      const params = mode === 'run' ? overrides.params : undefined;
      const r = await engineApi.queueRun({ graph_id: graphId, start: runStart, end: runEnd, ...(params && Object.keys(params).length ? { params } : {}) });
      if (runName.trim()) {
        const named = await setRunNameAction(r.id, runName);
        if (!named.ok) say('error', `Queued, but the name was not saved: ${named.error}`);
      }
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
        {runView && (
          <span className="rounded-chip bg-info/15 px-2 py-0.5 text-[11px] text-info" title="The run's own settings are filled into the graph; the saved graph is unchanged">
            Run settings: {runView.label} ·{' '}
            <a className="underline" href={`/studio/runs/${runView.runId}`}>run</a> ·{' '}
            <a className="underline" href={graphId ? `/studio/graphs/${graphId}` : '#'}>saved graph</a>
          </span>
        )}
        {runView && (
          <button className={btn} onClick={useRunSettings} title="Start a new run from these settings, on the current saved graph">
            Use these settings
          </button>
        )}
        {graphId && !runView && (
          <div className="flex overflow-hidden rounded border border-line-2 text-xs" title="Graph: edits change the graph. Run settings: edits apply to the next run only.">
            <button className={`px-2 py-1 ${mode === 'graph' ? 'bg-raised font-medium text-fg' : 'text-fg-2'}`} onClick={() => mode === 'run' && leaveRunMode()}>Graph</button>
            <button className={`px-2 py-1 ${mode === 'run' ? 'bg-[#EA7A12] font-medium text-white' : 'text-fg-2'}`} onClick={() => mode === 'graph' && enterRunMode()}>
              Run settings{mode === 'run' && Object.keys(overrides.params).length ? ` (${Object.keys(overrides.params).length})` : ''}
            </button>
          </div>
        )}
        <button className={btnPrimary} onClick={save} disabled={mode === 'run' || !!runView || !!busy || !name.trim() || nodes.length === 0}>
          {graphId ? 'Save' : 'Save new'}
        </button>
        {graphId && version !== null && (
          <button
            className="rounded-chip bg-line px-2 py-0.5 text-[11px] text-fg-2 hover:bg-line-2"
            title="Each save that changes the graph adds a version; runs record the version they used. Click for the history."
            onClick={() => setTab('history')}
          >
            v{version}
          </button>
        )}
        {graphId && (
          <input
            value={saveNote}
            onChange={(e) => setSaveNote(e.target.value)}
            placeholder="change note (optional)"
            maxLength={500}
            className="w-44 rounded border border-line-2 bg-bg px-2 py-1 text-xs text-fg"
            title="Saved with the new version when the graph changed"
          />
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
        <button className={btn} onClick={removeSaved} disabled={mode === 'run' || !!runView || !graphId || !!busy}>
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
            nodesConnectable={!locked}
            isValidConnection={isValidConnection}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onSelectionChange={({ nodes: sel }) => setSelectedId(sel.length === 1 ? sel[0].id : null)}
            deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
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
            {(['props', 'issues', 'run', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2 font-medium ${tab === t ? 'border-b-2 border-accent text-fg' : 'text-fg-2 hover:bg-line'}`}
              >
                {t === 'props' ? 'Properties' : t === 'issues' ? `Issues${issues.length ? ` (${issues.length})` : ''}` : t === 'run' ? 'Run' : 'History'}
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
                overrides={selected ? runOverrides[selected.id] : undefined}
                onResetOverride={mode === 'run' && selected ? (key) => resetSetting(selected.id, key) : undefined}
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
            {tab === 'history' && (
              <HistoryPanel
                graphId={graphId}
                current={currentGraph()}
                currentVersion={version}
                refreshKey={historyKey}
                onOpen={openVersion}
                onRestored={restored}
              />
            )}
            {tab === 'run' && (
              <RunPanel
                onQueue={queueBacktest}
                canQueue={!!graphId && !runView}
                runMode={mode === 'run'}
                runSettings={overrides}
                onResetSetting={resetSetting}
                onClearSettings={clearRunSettings}
                runName={runName}
                setRunName={setRunName}
                graphIdForTune={graphId}
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
              {(() => {
                const report = preview.strategies[Math.min(resultIdx, preview.strategies.length - 1)];
                return (
                  <StrategyResult
                    report={report}
                    chartHeight={240}
                    chart={previewChart ? <RunChart key={report.node} source={previewChart} report={report} graphId={graphId} onSaved={(chart) => setMeta((m) => ({ ...m, chart }))} /> : undefined}
                  />
                );
              })()}
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
  overrides,
  onResetOverride,
}: {
  selected: EngineNode | null;
  clock: GraphJson['clock'];
  setClock: (c: GraphJson['clock']) => void;
  outputs: string[];
  toggleOutput: (ref: string) => void;
  updateParams: (id: string, p: Record<string, unknown>) => void;
  renameNode: (oldId: string, newId: string) => string | null;
  nodeCount: number;
  /** run view: settings this run overrides, with the saved graph's value of each */
  overrides?: Record<string, unknown>;
  onResetOverride?: (key: string) => void;
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
              overrides={overrides}
              onResetOverride={onResetOverride}
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

/** A run setting in a few words: capital blocks as their shares, short values as they are. */
function settingSummary(v: unknown): string {
  if (isCapitalBlocks(v)) return `${v.length} block${v.length === 1 ? '' : 's'} · ${v.map((b) => `${b.allocation_percentage ?? 100}%`).join(' / ')}`;
  if (typeof v === 'number') return v.toLocaleString();
  const t = typeof v === 'string' ? v : JSON.stringify(v);
  return t.length > 60 ? `${t.slice(0, 57)}...` : t;
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
  graphIdForTune,
  busy,
  disabled,
  result,
  error,
  runMode,
  runSettings,
  onResetSetting,
  onClearSettings,
  runName,
  setRunName,
}: {
  onQueue: () => void;
  canQueue: boolean;
  /** Run settings mode: the list of settings for the next run, each with a way back to the graph's value */
  runMode: boolean;
  runSettings: ParamDiff;
  onResetSetting: (node: string, key: string) => void;
  onClearSettings: () => void;
  runName: string;
  setRunName: (v: string) => void;
  graphIdForTune?: string | null;
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
  const settings = Object.entries(runSettings.params);
  return (
    <div className="space-y-3 text-xs">
      {runMode && (
        <div className="rounded border border-[#EA7A12]/60 bg-[#EA7A12]/10 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-[#EA7A12]">Run settings ({settings.length})</span>
            {settings.length > 0 && <button className="text-[11px] text-accent hover:underline" onClick={onClearSettings}>clear all</button>}
          </div>
          {settings.length === 0 ? (
            <p className="text-fg-2">None yet: change a block&apos;s settings on the canvas. They apply to the next run only.</p>
          ) : (
            <ul className="space-y-1">
              {settings.map(([ref, v]) => {
                const i = ref.indexOf('.');
                const node = ref.slice(0, i);
                const key = ref.slice(i + 1);
                return (
                  <li key={ref} className="flex items-baseline gap-2">
                    <span className="shrink-0 font-medium">{node} · {key}</span>
                    <span className="min-w-0 flex-1 truncate text-fg-2" title={JSON.stringify(v)}>{settingSummary(v)}</span>
                    <button className="shrink-0 text-accent hover:underline" title="Back to the graph's saved value" onClick={() => onResetSetting(node, key)}>↺</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
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
      <label className="block">
        Run name (optional)
        <input
          value={runName}
          onChange={(e) => setRunName(e.target.value)}
          maxLength={120}
          placeholder="e.g. SET2-8"
          className="w-full rounded border border-line-2 bg-bg px-2 py-1 text-fg"
          title="Shown with the run on Runs and Backtest"
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
        {runMode ? 'Run full backtest with these settings' : 'Run full backtest'}
      </button>
      {canQueue && graphIdForTune && (
        <a className="ml-2 text-accent hover:underline" href={`/studio/experiments/new?graph=${graphIdForTune}`}>
          Tune with walk-forward
        </a>
      )}
      <p className="text-[10px] text-fg-3">
        Preview runs the graph on screen as it is now. Full backtest runs the last saved version in the background and keeps the result under Runs{runMode ? ', with the run settings above on top' : ''}.
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
  /** With initialGraphId: show the graph version this run used, with the run's own settings applied (read-only). */
  runId?: string | null;
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
