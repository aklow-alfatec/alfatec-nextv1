// A run's own settings applied on top of its graph (features/studio/run-params.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyRunParams, isCapitalBlocks, paramsByNode, triggerText } from '../features/studio/run-params.ts';

const graph = {
  format: 'alfatec.graph/1', name: 'g', clock: { timeframe: '1W' }, outputs: [], edges: [],
  nodes: [
    { id: 'NEXTV0', type: 'strategy.nextv0_policy', params: { initial_fund: 10000 } },
    { id: 'TRIGGERS', type: 'signal.grade_triggers', params: { blocks: [{ id: 'a', allocation_percentage: 100, triggers: [{ id: 't', threshold_grade: 70 }] }] } },
  ],
} as never;

const blocks = [
  { id: 'b1', allocation_percentage: 50, triggers: [{ id: '1', action: 'long', comparison: 'greater_than', threshold_grade: 96 }, { id: '2', action: 'short', comparison: 'less_than', threshold_grade: 30 }] },
  { id: 'b2', allocation_percentage: 50, triggers: [{ id: '3', action: 'long', comparison: 'greater_than', threshold_grade: 96 }, { id: '4', action: 'short', comparison: 'less_than', threshold_grade: 50 }] },
];

test('run settings replace a node param and leave the graph itself unchanged', () => {
  const g = applyRunParams(graph, { 'NEXTV0.blocks': blocks, 'NEXTV0.initial_fund': 100000 }) as never as { nodes: { id: string; params: Record<string, unknown> }[] };
  const n = g.nodes.find((x) => x.id === 'NEXTV0')!;
  assert.deepEqual(n.params, { initial_fund: 100000, blocks });
  assert.deepEqual((graph as never as { nodes: { params: unknown }[] }).nodes[0].params, { initial_fund: 10000 });
});

test('dotted paths reach into lists; unknown nodes are ignored', () => {
  const g = applyRunParams(graph, { 'TRIGGERS.blocks.0.triggers.0.threshold_grade': 65, 'NOPE.x': 1 }) as never as { nodes: { id: string; params: { blocks?: { triggers: { threshold_grade: number }[] }[] } }[] };
  assert.equal(g.nodes[1].params.blocks![0].triggers[0].threshold_grade, 65);
  assert.equal(g.nodes.length, 2);
});

test('settings grouped by node and triggers in words', () => {
  assert.deepEqual(Object.keys(paramsByNode({ 'NEXTV0.blocks': blocks, 'NEXTV0.initial_fund': 1 })), ['NEXTV0']);
  assert.ok(isCapitalBlocks(blocks));
  assert.equal(triggerText(blocks[0].triggers[0]), 'Buy when the grade is above 96');
  assert.equal(triggerText(blocks[1].triggers[1]), 'Sell when the grade is below 50');
});

test('diffParams finds the changed top-level settings and the saved value of each; key order does not matter', async () => {
  const { diffParams, sameGraph } = await import('../features/studio/run-params.ts');
  const base = graph as never as { nodes: { id: string; params: Record<string, unknown> }[] };
  const nodes = [
    { id: 'NEXTV0', params: { initial_fund: 10000 } },                                   // unchanged
    { id: 'TRIGGERS', params: { blocks }, },                                             // changed
    { id: 'NEW', params: { x: 1 } },                                                      // not in base: ignored
  ];
  const d = diffParams(base as never, nodes);
  assert.deepEqual(Object.keys(d.params), ['TRIGGERS.blocks']);
  assert.deepEqual(Object.keys(d.byNode.TRIGGERS), ['blocks']);
  assert.equal((d.byNode.TRIGGERS.blocks as unknown[]).length, 1); // the saved value: one block
  // same values written in another key order are not a change
  const flip = (v: unknown): unknown => Array.isArray(v) ? v.map(flip)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, flip(x)])) : v;
  const reordered = base.nodes.map((n) => ({ id: n.id, params: flip(n.params) as Record<string, unknown> }));
  assert.deepEqual(diffParams(base as never, reordered).params, {});
  assert.ok(sameGraph(graph, applyRunParams(graph, {})));
  assert.ok(!sameGraph(graph, applyRunParams(graph, { 'NEXTV0.initial_fund': 5 })));
});
