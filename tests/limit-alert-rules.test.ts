import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePercent, pct, sortBreaches, type BreachRow } from '../lib/limit-alert-rules.ts';

test('parsePercent reads percentages and rejects bad input', () => {
  assert.equal(parsePercent('20'), 0.2);
  assert.equal(parsePercent(' 20 % '), 0.2);
  assert.equal(parsePercent('12.5'), 0.125);
  assert.equal(parsePercent(''), '');
  assert.equal(parsePercent('abc'), null);
  assert.equal(parsePercent('0'), null);
  assert.equal(parsePercent('-5'), null);
  assert.equal(parsePercent('600'), null);
});

test('pct formats a fraction', () => {
  assert.equal(pct(0.688), '69%');
  assert.equal(pct(0.2, 1), '20.0%');
});

test('sortBreaches puts new first, then the largest excess', () => {
  const r = (symbol: string, isNew: boolean, excess: number) => ({ symbol, isNew, excess }) as BreachRow;
  const out = sortBreaches([r('A', false, 0.3), r('B', true, 0.21), r('C', false, 0.69), r('D', true, 0.4)]);
  assert.deepEqual(out.map((x) => x.symbol), ['D', 'B', 'C', 'A']);
});
