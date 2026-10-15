import {
  type BlockSpec,
  type EngineEdge,
  type EngineNode,
  type GraphJson,
  inHandle,
  outHandle,
  portOf,
} from './types';

type UiBag = Record<string, unknown>;

function readPosition(ui: UiBag | null | undefined): { x: number; y: number } | null {
  if (!ui) return null;
  if (typeof ui.x === 'number' && typeof ui.y === 'number') return { x: ui.x, y: ui.y };
  const p = ui.position as { x?: unknown; y?: unknown } | undefined; // legacy converter uses ui.position
  if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
  return null;
}

/** Spec for a block type the catalogue does not know: ports inferred from the edges, so the graph still loads. */
function placeholderSpec(type: string, nodeId: string, edges: GraphJson['edges']): BlockSpec {
  const inputs: BlockSpec['inputs'] = {};
  const outputs: BlockSpec['outputs'] = {};
  for (const e of edges) {
    const [sn, ...sp] = e.from.split('.');
    const [dn, ...dp] = e.to.split('.');
    if (sn === nodeId) outputs[sp.join('.')] = { dtype: 'float', optional: false, variadic: false, doc: '' };
    if (dn === nodeId) inputs[dp.join('.')] = { dtype: 'float', optional: true, variadic: true, doc: '' };
  }
  return {
    type,
    label: type,
    category: 'Unknown',
    description: 'Block type not found in the catalogue.',
    inputs,
    outputs,
    params: { type: 'object', properties: {} },
    timeframes: null,
    example_params: null,
  };
}

export function graphToFlow(
  graph: GraphJson,
  catalogue: Map<string, BlockSpec>,
): { nodes: EngineNode[]; edges: EngineEdge[] } {
  const nodes: EngineNode[] = graph.nodes.map((n, i) => {
    const known = catalogue.get(n.type);
    const spec = known ?? placeholderSpec(n.type, n.id, graph.edges);
    const ui = { ...(n.ui ?? {}) };
    const pos = readPosition(ui) ?? { x: 60 + (i % 4) * 260, y: 40 + Math.floor(i / 4) * 200 };
    return {
      id: n.id,
      type: 'engine',
      position: pos,
      data: { blockType: n.type, spec, params: { ...n.params }, ui, unknownBlock: !known },
    };
  });
  const edges: EngineEdge[] = graph.edges.map((e) => {
    const [sn, ...sp] = e.from.split('.');
    const [dn, ...dp] = e.to.split('.');
    return {
      id: `${e.from}->${e.to}`,
      source: sn,
      sourceHandle: outHandle(sp.join('.')),
      target: dn,
      targetHandle: inHandle(dp.join('.')),
    };
  });
  return { nodes, edges };
}

export interface GraphExtras {
  name?: string | null;
  clock: GraphJson['clock'];
  outputs: string[];
  meta?: Record<string, unknown>;
  format?: string;
}

export function flowToGraph(nodes: EngineNode[], edges: EngineEdge[], extras: GraphExtras): GraphJson {
  const ids = new Set(nodes.map((n) => n.id));
  const g: GraphJson = {
    format: extras.format ?? 'alfatec.graph/1',
    clock: extras.clock.anchor ? extras.clock : { timeframe: extras.clock.timeframe },
    nodes: nodes.map((n) => {
      const { position: _legacyPos, ...rest } = n.data.ui as UiBag;
      void _legacyPos;
      return {
        id: n.id,
        type: n.data.blockType,
        params: n.data.params,
        ui: { ...rest, x: Math.round(n.position.x), y: Math.round(n.position.y) },
      };
    }),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({
        from: `${e.source}.${portOf(e.sourceHandle)}`,
        to: `${e.target}.${portOf(e.targetHandle)}`,
      })),
    outputs: extras.outputs.filter((o) => ids.has(o.split('.')[0])),
  };
  if (extras.name) g.name = extras.name;
  if (extras.meta && Object.keys(extras.meta).length) g.meta = extras.meta;
  return g;
}
