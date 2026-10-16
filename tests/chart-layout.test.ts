import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlot } from '../features/charts/build.ts';
import { INDICATOR_MENU, indicatorSeries, initialLayout, parseLayout, presetLayout, resolveLayout, sameLayout, type ChartLayout } from '../features/charts/layout.ts';

const info = (ref: string, kind: string, block_type: string, extra: object = {}) => {
  const cut = ref.lastIndexOf('.');
  return { ref, node: ref.slice(0, cut), port: ref.slice(cut + 1), block_type, block_label: block_type, dtype: 'float', kind, min: 0, max: 1, ...extra };
};
// shaped like GOLD_V2A's catalogue
const CAT = [
  info('BPGDM_GRADE.grade', 'part_score', 'legacy.linearGraderTimeVaryingChain'),
  info('GOLD/SILVER_GRADE.grade', 'part_score', 'legacy.linearGraderTimeVaryingChain'),
  info('GOLD_DAILY_GRADE.pct', 'grade_pct', 'legacy.nodeAdderChain'),
  info('PRICE.close', 'price', 'data.bars'),
  info('TRIGGERS.signal', 'other', 'signal.grade_triggers'),
  info('TRIGGERS.fired', 'bool', 'signal.grade_triggers', { dtype: 'bool' }),
] as never[];

test('Strategy preset: price, trades, daily grade %, trigger signal, equity', () => {
  const l = presetLayout('strategy', CAT, 'PRICE.close');
  assert.deepEqual(
    l.series.map((s) => [s.id, s.pane]),
    [['PRICE.close', 'price'], ['@trades', 'price'], ['GOLD_DAILY_GRADE.pct', 'grade'], ['TRIGGERS.signal', 'bool'], ['@equity', 'equity']],
  );
});

test('Grade preset: price, grade %, part scores, equity', () => {
  const l = presetLayout('grade', CAT, 'PRICE.close');
  assert.deepEqual(l.series.map((s) => s.pane), ['price', 'grade', 'score', 'score', 'equity']);
});

test('Momentum preset adds SMA 40 on the price pane, RSI 14 on 0-100 and a z-score pane', () => {
  const l = presetLayout('momentum', CAT, 'PRICE.close');
  const ind = l.series.filter((s) => s.indicator);
  assert.deepEqual(
    ind.map((s) => [s.indicator!.label, s.indicator!.type, s.pane]),
    [['SMA 40', 'trend.sma', 'price'], ['RSI 14', 'momentum.rsi', 'pct'], ['Z 52', 'stats.zscore', 'other']],
  );
  assert.ok(ind.every((s) => s.indicator!.input === 'PRICE.close'));
});

test('a multi-output indicator becomes one series per output, sharing a colour', () => {
  const bb = INDICATOR_MENU.find((m) => m.id === 'bb')!;
  const ss = indicatorSeries(bb, { period: 20, nbdev: 2 }, 'PRICE.close', []);
  assert.deepEqual(ss.map((s) => s.indicator!.output), ['upper', 'mid', 'lower']);
  assert.equal(new Set(ss.map((s) => s.color)).size, 1);
  assert.equal(new Set(ss.map((s) => s.id)).size, 3);
});

test('the price falls back to the first price series when the wired ref is unknown', () => {
  const l = presetLayout('strategy', CAT, 'GONE.close');
  assert.equal(l.series[0].ref, 'PRICE.close');
});

test('resolveLayout lists graph series a newer graph version removed', () => {
  const l = presetLayout('grade', CAT, 'PRICE.close');
  const { present, missing } = resolveLayout(l, CAT.slice(2));
  assert.deepEqual(missing.map((s) => s.ref), ['BPGDM_GRADE.grade', 'GOLD/SILVER_GRADE.grade']);
  assert.ok(present.some((s) => s.special === 'equity'));
});

test('parseLayout / initialLayout never trust a stored layout', () => {
  assert.equal(parseLayout(null), null);
  assert.equal(parseLayout({ v: 2, series: [] }), null);
  assert.equal(parseLayout('x'), null);
  const l = parseLayout({
    v: 1,
    preset: 'custom',
    series: [{ id: 'a', ref: 'a.b', pane: 'price', color: '#fff' }, { id: 'bad', pane: 'nowhere', color: '#fff', ref: 'x.y' }, { id: 'noref', pane: 'price', color: '#fff' }, 7],
  });
  assert.deepEqual(l!.series.map((s) => s.id), ['a']);
  // a saved layout wins; a broken or empty one falls back to the Strategy preset
  const saved: ChartLayout = { v: 1, preset: 'custom', series: [{ id: 'PRICE.close', ref: 'PRICE.close', pane: 'price', color: '#abcdef' }] };
  assert.equal(initialLayout(saved, CAT, 'PRICE.close').series[0].color, '#abcdef');
  assert.equal(initialLayout({ v: 1, series: [] }, CAT, 'PRICE.close').preset, 'strategy');
  assert.equal(initialLayout(undefined, CAT, 'PRICE.close').preset, 'strategy');
});

test('a layout survives a JSON round trip (graph.meta.chart)', () => {
  const l = presetLayout('momentum', CAT, 'PRICE.close');
  assert.ok(sameLayout(l, parseLayout(JSON.parse(JSON.stringify(l)))));
  assert.ok(!sameLayout(l, presetLayout('strategy', CAT, 'PRICE.close')));
});

test('buildPlot: -1 part scores are gaps, missing columns are skipped, indicators use their own grid', () => {
  const l = presetLayout('momentum', CAT, 'PRICE.close');
  const graph = { t: [1, 2, 3], cols: { 'PRICE.close': [10, 11, 12], 'BPGDM_GRADE.grade': [-1, 3, 4] } };
  const sma = l.series.find((s) => s.indicator?.label === 'SMA 40')!;
  const layout = [...l.series, { id: 'BPGDM_GRADE.grade', ref: 'BPGDM_GRADE.grade', pane: 'score' as const, color: '#fff' }];
  const out = buildPlot(layout, graph, { [sma.id]: { t: [1, 3], v: [null, 11] } }, (r) => (r.endsWith('.grade') ? 'part_score' : 'price'));
  assert.deepEqual(out.map((s) => s.id), ['PRICE.close', sma.id, 'BPGDM_GRADE.grade']);
  assert.deepEqual(out[2].v, [null, 3, 4]);
  assert.deepEqual(out[1].t, [1, 3]);
});
