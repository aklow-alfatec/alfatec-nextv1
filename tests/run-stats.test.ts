// Statistics shown for the runs a search matches (features/studio/run-stats.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stats } from '../features/studio/run-stats.ts';

test('average, max, min, median and mode, ignoring missing values', () => {
  const s = stats([0.1, 0.3, null, 0.2, 0.3, undefined, Number.NaN], 0.001);
  assert.equal(s.n, 4);
  assert.ok(Math.abs((s.average ?? 0) - 0.225) < 1e-12);
  assert.equal(s.max, 0.3);
  assert.equal(s.min, 0.1);
  assert.ok(Math.abs((s.median ?? 0) - 0.25) < 1e-12);
  assert.ok(Math.abs((s.mode ?? 0) - 0.3) < 1e-12);
  assert.equal(s.modeCount, 2);
});

test('the mode is taken at the shown precision; none when nothing repeats', () => {
  assert.ok(Math.abs((stats([1.231, 1.234, 2], 0.01).mode ?? 0) - 1.23) < 1e-12);
  assert.equal(stats([1, 2, 3], 0.01).mode, null);
  assert.equal(stats([], 0.01).average, null);
  assert.equal(stats([5], 0.01).median, 5);
});
