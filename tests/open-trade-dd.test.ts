// Open-trade drawdown from entry (features/charts/open-trade.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openTradeDrawdown } from '../features/charts/open-trade.ts';

const close = (a: (number | null)[], b: (number | null)[]) => {
  assert.equal(a.length, b.length);
  a.forEach((x, i) => (x === null || b[i] === null ? assert.equal(x, b[i], `i=${i}`) : assert.ok(Math.abs(x - (b[i] as number)) < 1e-9, `i=${i}: ${x} vs ${b[i]}`)));
};

test('a long: 0 at entry and while above it, negative below, null when flat', () => {
  const r = openTradeDrawdown([100, 110, 90, 95, 120, 80], [0, 1, 1, 1, 0, 0]);
  close(r.v, [null, 0, (90 / 110 - 1) * 100, (95 / 110 - 1) * 100, null, null]);
  assert.ok(Math.abs((r.max as number) - (90 / 110 - 1) * 100) < 1e-9);
});

test('a short loses when the price rises above its entry', () => {
  const r = openTradeDrawdown([100, 100, 125, 80], [0, -1, -1, -1]);
  close(r.v, [null, 0, -25, 0]);
  assert.equal(r.max, -25);
});

test('adding units moves the average cost; reducing keeps it; a flip starts over', () => {
  // 1 unit at 100, 2 at 80 -> cost 86.67 for 3 units; price 70 -> -19.2%; half sold keeps the cost
  const r = openTradeDrawdown([100, 80, 70, 70, 60, 60], [1, 3, 3, 1.5, -1, -1]);
  const cost = (100 + 2 * 80) / 3;
  close(r.v, [0, (80 / cost - 1) * 100, (70 / cost - 1) * 100, (70 / cost - 1) * 100, 0, (1 - 60 / 60) * 100 || 0]);
});

test('never in a position: no maximum', () => {
  assert.equal(openTradeDrawdown([1, 2, 3], [0, 0, 0]).max, null);
  assert.equal(openTradeDrawdown([], []).max, null);
});
