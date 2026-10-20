// Part-score heatmap data helpers (features/charts/heatmap.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heatAt, heatPoints } from '../features/charts/heat-data.ts';

const h = { rows: ['A', 'B'], t: [100, 200, 300], scores: [[5, 1], [4, null], [3, 2]] };

test('the readout takes the Friday at or before the hovered time', () => {
  assert.equal(heatAt(h, 50), null);
  assert.deepEqual(heatAt(h, 100), [5, 1]);
  assert.deepEqual(heatAt(h, 250), [4, null]);
  assert.deepEqual(heatAt(h, 999), [3, 2]);
});

test('one chart point per Friday, carrying every row', () => {
  const p = heatPoints(h);
  assert.equal(p.length, 3);
  assert.deepEqual(p[1], { time: 200, scores: [4, null] });
});
