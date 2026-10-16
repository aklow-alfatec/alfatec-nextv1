// Pins the grade % zone edges and colours to nextv0's (visx-heatmap-chart.tsx). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GRADE_ZONES, gradeZone, partScoreColor } from '../lib/grade-zones.ts';

test('zone edges: 96 / 90 / 80 undervalued, 40-80 normal, 36 / 30 overvalued', () => {
  const at = (g: number) => gradeZone(g).label;
  assert.equal(at(100), 'Extremely Undervalue');
  assert.equal(at(96), 'Extremely Undervalue');
  assert.equal(at(95.99), 'Very Undervalue');
  assert.equal(at(90), 'Very Undervalue');
  assert.equal(at(89.99), 'Undervalue');
  assert.equal(at(80), 'Undervalue');
  assert.equal(at(79.99), 'Normal');
  assert.equal(at(40), 'Normal');
  assert.equal(at(39.99), 'Overvalue');
  assert.equal(at(36), 'Overvalue');
  assert.equal(at(35.99), 'Very Overvalue');
  assert.equal(at(30), 'Very Overvalue');
  assert.equal(at(29.99), 'Extremely Overvalue');
  assert.equal(at(0), 'Extremely Overvalue');
});

test('zone colours; 40-80 has none', () => {
  assert.deepEqual(GRADE_ZONES.map((z) => z.color), ['#66ffff', '#caedfb', '#66ccff', null, '#ffccff', '#ff00ff', '#ff0066']);
  assert.equal(gradeZone(60).color, null);
});

test('zones are contiguous from 100 down to 0', () => {
  for (let i = 1; i < GRADE_ZONES.length; i++) assert.equal(GRADE_ZONES[i].max, GRADE_ZONES[i - 1].min);
  assert.equal(GRADE_ZONES[0].max, 100);
  assert.equal(GRADE_ZONES[GRADE_ZONES.length - 1].min, 0);
});

test('out-of-range grades fall into the end zones', () => {
  assert.equal(gradeZone(120).label, 'Extremely Undervalue');
  assert.equal(gradeZone(-5).label, 'Extremely Overvalue');
});

test('part scores 1..5: 5 undervalued, -1 (no data) uncoloured', () => {
  assert.deepEqual([5, 4, 3, 2, 1].map(partScoreColor), ['#66ffff', '#66ccff', '#ffccff', '#ff00ff', '#ff0066']);
  assert.equal(partScoreColor(-1), null);
  assert.equal(partScoreColor(null), null);
});
