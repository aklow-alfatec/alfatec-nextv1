// Channel maths (lib/channel.ts) against the backend's stored grades. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertLevels, channelAt, inputValue, latestClose, positionIn, relDiff, scoreOf, type ChannelParams } from '../lib/channel.ts';

const day = (d: string) => Date.parse(d);
const close = (a: number, b: number, tol = 1e-9) => assert.ok(relDiff(a, b) < tol, `${a} vs ${b}`);

// LAC_V1 DXY/LAC_GRADE, and what the backend stored for 2026-11-20
const LAC: ChannelParams = {
  scaling: 'log',
  limitSegments: [{
    date: { start: '2011-01-01', end: '2026-01-01' }, upperDate: { start: '2011-01-01', end: '2026-01-01' },
    lowerDate: { start: '2011-01-01', end: '2026-01-01' },
    limit: { startUpper: 162.37, endUpper: 38.11, startLower: 10.32, endLower: 10.2 },
    effective_date: { start: '2008-01-01', end: '2040-01-01' },
  }],
};
const LAC_STORED = [13.04447652404853, 16.693699412002516, 21.363800957786633, 27.340374359189166];

// DAL_V1 DAL/JETS_GRADE: the cheap line is drawn below the expensive one (descending thresholds)
const DAL: ChannelParams = {
  scaling: 'log',
  limitSegments: [{
    date: { start: '2017-01-01', end: '2026-01-01' }, upperDate: { start: '2017-01-01', end: '2026-01-01' },
    lowerDate: { start: '2017-01-01', end: '2026-01-01' },
    limit: { startUpper: 1.55, endUpper: 1.87, startLower: 2.1, endLower: 2.66 },
    effective_date: { start: '2007-01-01', end: '2040-01-01' },
  }],
};
const DAL_STORED = [2.53481416311354, 2.360056534330661, 2.1973472163321524, 2.0458555627321147];

test('thresholds match the stored grades (log, both orientations)', () => {
  const c = channelAt(LAC, day('2026-11-20'))!;
  LAC_STORED.forEach((t, i) => close(c.thresholds[i], t));
  assert.equal(scoreOf(81.76377952755905, c.thresholds), 5);
  const d = channelAt(DAL, day('2026-11-20'))!;
  DAL_STORED.forEach((t, i) => close(d.thresholds[i], t));
  assert.equal(scoreOf(2.9502212389380533, d.thresholds), 1);
});

test('linear channel, extension beyond the points, and effective dates', () => {
  const p: ChannelParams = {
    limitSegments: [{
      date: { start: '2020-01-01', end: '2021-01-01' },
      limit: { startUpper: 100, endUpper: 200, startLower: 0, endLower: 100 },
      effective_date: { start: '2019-01-01', end: '2030-01-01' },
    }],
  };
  const c = channelAt(p, day('2020-01-01'))!;
  assert.deepEqual([c.lower, c.upper], [0, 100]);
  assert.deepEqual(c.thresholds, [20, 40, 60, 80]);
  const half = channelAt(p, (day('2020-01-01') + day('2021-01-01')) / 2)!;
  close(half.upper, 150);
  const ahead = channelAt(p, day('2022-01-01'))!;      // extended straight past the second point
  assert.ok(ahead.upper > 299 && ahead.upper < 301);
  assert.equal(channelAt(p, day('2018-06-01')), null);  // before the segment is in effect
  assert.equal(channelAt(p, day('2031-01-01')), null);
});

test('alert levels and position (the featureAsk-001 example: 69% beyond the cheap line)', () => {
  const c = channelAt(LAC, day('2026-11-20'))!;
  const a = alertLevels(c, true, 0.2)!;
  close(a.cheap, 44.77713726911662, 1e-6);
  close(a.expensive, 7.964798404678749, 1e-6);
  const p = positionIn(81.76377952755905, c, true)!;
  assert.equal(Math.round((p - 1) * 100), 69);
  const lin = { lower: 0, upper: 100, thresholds: [20, 40, 60, 80] };
  assert.deepEqual(alertLevels(lin, false, 0.2), { cheap: 120, expensive: -20 });
  assert.equal(positionIn(50, lin, false), 0.5);
});

test('latest close honours the stale window, and input kinds', () => {
  const s = [{ t: day('2026-01-01'), close: 10 }, { t: day('2026-03-01'), close: 12 }];
  assert.equal(latestClose(s, day('2025-12-31'), 150), null);
  assert.equal(latestClose(s, day('2026-02-15'), 150), 10);
  assert.equal(latestClose(s, day('2026-09-01'), 150), null);   // 184 days old
  assert.equal(latestClose(s, day('2026-09-01'), 183 + 1), 12);
  assert.equal(inputValue('ratio', 10, 4), 2.5);
  assert.equal(inputValue('ratio', 10, 0), null);
  assert.equal(inputValue('minus', 10, 4), 6);
  assert.equal(inputValue('single', 10, null), 10);
  assert.equal(inputValue('ratio', 10, null), null);
});
