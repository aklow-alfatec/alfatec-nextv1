// The position still open at the end of a run, from the position series (features/charts/build.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTradeFromPosition } from '../features/charts/build.ts';

const t = [10, 20, 30, 40, 50, 60];

test('the entry is where the last stretch with the same sign starts', () => {
  assert.deepEqual(openTradeFromPosition(t, [0, 5, 5, 0, 0, 3]), { entry: 60, exit: 60, side: 'long', ret: null, open: true });
  assert.deepEqual(openTradeFromPosition(t, [0, 5, 5, 6, 7, 3])?.entry, 20);      // scaling in keeps the first entry
  assert.deepEqual(openTradeFromPosition(t, [2, 2, -1, -1, -3, -3]), { entry: 30, exit: 30, side: 'short', ret: null, open: true });
  assert.equal(openTradeFromPosition(t, [4, 4, 4, 4, 4, 4])?.entry, 10);           // held from the start
});

test('flat or missing at the end: no open trade', () => {
  assert.equal(openTradeFromPosition(t, [0, 5, 5, 0, 0, 0]), null);
  assert.equal(openTradeFromPosition(t, [1, 1, 1, 1, 1, null]), null);
  assert.equal(openTradeFromPosition([], []), null);
});
