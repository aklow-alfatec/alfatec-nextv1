import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bandRanges, indexAtOrBefore, nearestTime, pairs, toSeconds, valueAt } from '../features/charts/data.ts';

test('toSeconds reads naive engine timestamps as UTC', () => {
  assert.equal(toSeconds('2005-01-07T00:00:00'), Date.UTC(2005, 0, 7) / 1000);
  assert.equal(toSeconds('2005-01-07T00:00:00Z'), Date.UTC(2005, 0, 7) / 1000);
  assert.equal(toSeconds('2005-01-07T02:00:00+02:00'), Date.UTC(2005, 0, 7) / 1000);
});

test('indexAtOrBefore / valueAt: the crosshair reads the last sample at or before the time', () => {
  const s = { t: [10, 20, 30], v: [1, null, 3] as (number | null)[] };
  assert.equal(indexAtOrBefore(s.t, 5), -1);
  assert.equal(indexAtOrBefore(s.t, 10), 0);
  assert.equal(indexAtOrBefore(s.t, 29), 1);
  assert.equal(indexAtOrBefore(s.t, 99), 2);
  assert.equal(valueAt(s, 5), null);
  assert.equal(valueAt(s, 25), null);
  assert.equal(valueAt(s, 31), 3);
});

test('nearestTime snaps a trade to a bar the series has', () => {
  const t = [100, 200, 300];
  assert.equal(nearestTime(t, 140), 100);
  assert.equal(nearestTime(t, 160), 200);
  assert.equal(nearestTime(t, 50), 100);
  assert.equal(nearestTime(t, 999), 300);
  assert.equal(nearestTime([], 1), null);
});

test('bandRanges: a signal reported only on change shades the whole span', () => {
  const t = [1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual(bandRanges({ t, v: [1, null, null, 0, null, 1, null] }), [[1, 4], [6, 7]]);
  assert.deepEqual(bandRanges({ t, v: [0, 0, 1, 1, 0, 0, 0] }), [[3, 5]]);
  assert.deepEqual(bandRanges({ t, v: [null, null, null, null, null, null, null] }), []);
});

test('pairs drops nulls, NaN and non-ascending times', () => {
  assert.deepEqual(pairs([1, 2, 3, 3, 4], [1, null, Number.NaN, 5, 6]), [{ time: 1, value: 1 }, { time: 3, value: 5 }, { time: 4, value: 6 }]);
});
