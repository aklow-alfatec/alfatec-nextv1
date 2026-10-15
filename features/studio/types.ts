import type { Node, Edge } from '@xyflow/react';

export type Dtype = 'float' | 'int' | 'bool' | 'object';

export interface PortSpec {
  dtype: Dtype;
  optional: boolean;
  variadic: boolean;
  doc: string;
}

/** One entry of GET /api/v1/blocks (Block.schema()). */
export interface BlockSpec {
  type: string;
  label: string;
  category: string;
  description: string;
  inputs: Record<string, PortSpec>;
  outputs: Record<string, PortSpec>;
  params: JsonSchema;
  stateful?: boolean;
  fittable?: boolean;
  timeframes: string[] | null;
  example_params: Record<string, unknown> | null;
}

export interface JsonSchema {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  [k: string]: unknown;
}

export interface Issue {
  node: string | null;
  port: string | null;
  message: string;
  level: 'error' | 'warning';
  text?: string;
}

/** alfatec.graph/1 */
export interface GraphJson {
  format: string;
  name?: string | null;
  clock: { timeframe: string; anchor?: string | null };
  nodes: { id: string; type: string; params: Record<string, unknown>; ui?: Record<string, unknown> | null }[];
  edges: { from: string; to: string }[];
  outputs: string[];
  meta?: Record<string, unknown>;
}

export interface GraphMeta {
  id: string;
  name: string;
  symbol: string | null;
  graph_hash: string;
  legacy_pipeline: string | null;
  active: boolean;
  updated_at: string;
}

export interface GraphRecord extends GraphMeta {
  graph: GraphJson;
}

export type EngineNodeData = {
  blockType: string;
  spec: BlockSpec;
  params: Record<string, unknown>;
  /** unknown ui keys from the loaded graph, preserved on save */
  ui: Record<string, unknown>;
  issues?: Issue[];
  unknownBlock?: boolean;
};

export type EngineNode = Node<EngineNodeData, 'engine'>;
export type EngineEdge = Edge;

export const DTYPE_COLOR: Record<Dtype, string> = {
  float: 'rgb(var(--info))',
  int: 'rgb(var(--positive))',
  bool: 'rgb(var(--warning))',
  object: '#B28CF0',
};

/** Mirrors backend validate.COMPATIBLE: input dtype -> output dtypes it accepts. */
const COMPATIBLE: Record<Dtype, Dtype[]> = {
  float: ['float', 'int', 'bool'],
  int: ['int', 'bool'],
  bool: ['bool'],
  object: ['float', 'int', 'bool', 'object'],
};

export function dtypeCompatible(src: Dtype, dst: Dtype): boolean {
  return (COMPATIBLE[dst] ?? []).includes(src);
}

export const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D', '1W', '1M', '3M'];
export const WEEK_ANCHORS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const inHandle = (name: string) => `in:${name}`;
export const outHandle = (name: string) => `out:${name}`;
export const portOf = (handle: string | null | undefined) => (handle ?? '').replace(/^(in|out):/, '');
