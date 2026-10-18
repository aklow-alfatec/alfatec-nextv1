// Dashboard sections from assets.asset_type, with a per-pipeline `section:<key>` tag override. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayTags, groupBySection, sectionOf } from '../lib/sections.ts';

test('asset types map to the four sections, anything else to Other', () => {
  assert.equal(sectionOf('COMMODITY'), 'commodity');
  assert.equal(sectionOf('commodity'), 'commodity');
  assert.equal(sectionOf('PRECIOUS METAL'), 'commodity');
  assert.equal(sectionOf('INDEX'), 'index');
  assert.equal(sectionOf('ETF'), 'etf');
  assert.equal(sectionOf(' Stock '), 'stocks');
  for (const t of ['CURRENCY', 'INDICATOR', '', null, undefined]) assert.equal(sectionOf(t), 'other', String(t));
});

test('a section tag overrides the asset type; unknown tags are ignored', () => {
  assert.equal(sectionOf('ETF', ['LITHIUM_V2', 'section:commodity']), 'commodity');
  assert.equal(sectionOf('ETF', ['Section:Index']), 'index');
  assert.equal(sectionOf('ETF', ['section:crypto']), 'etf');
  assert.deepEqual(displayTags(['LITHIUM_V2', 'section:commodity']), ['LITHIUM_V2']);
});

test('groups keep section order and item order, and skip empty sections', () => {
  const items = [{ s: 'B', section: 'stocks' }, { s: 'G', section: 'commodity' }, { s: 'A', section: 'stocks' }] as const;
  const g = groupBySection([...items]);
  assert.deepEqual(g.map((x) => x.key), ['commodity', 'stocks']);
  assert.deepEqual(g[1].items.map((x) => x.s), ['B', 'A']);
});
