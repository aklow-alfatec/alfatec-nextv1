// Guest view rules (lib/access.ts): roles, guest mode, blocked paths, masking. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUEST_MODE_VALUE, blockedForGuest, canUseStudio, effectiveRole, isGuestView, maskParts } from '../lib/access.ts';

test('full access for viewer, user, admin, superadmin; everything else is the guest view', () => {
  for (const r of ['viewer', 'user', 'admin', 'superadmin']) assert.equal(isGuestView(r), false, r);
  for (const r of ['guest', '', null, undefined, 'Admin', 'superadmin ', 'owner']) assert.equal(isGuestView(r), true, String(r));
  assert.equal(canUseStudio('guest'), false);
  assert.equal(canUseStudio('viewer'), true);
});

test('guest mode applies to superadmins only; the cookie is ignored for everyone else', () => {
  assert.equal(effectiveRole('superadmin', GUEST_MODE_VALUE), 'guest');
  assert.equal(effectiveRole('superadmin', undefined), 'superadmin');
  assert.equal(effectiveRole('superadmin', 'admin'), 'superadmin');
  for (const r of ['admin', 'viewer', 'user', 'guest']) assert.equal(effectiveRole(r, GUEST_MODE_VALUE), r, r);
  assert.equal(effectiveRole(null, GUEST_MODE_VALUE), null);
});

test('blocked paths: Studio, Data, a new trade and the engine / studio data APIs; the Overview section is open', () => {
  for (const p of ['/studio', '/studio/graphs', '/studio/runs/abc', '/trades/new', '/data',
    '/api/engine/blocks', '/api/studio-db/graphs']) assert.ok(blockedForGuest(p), p);
  for (const p of ['/', '/grades', '/settings', '/symbols', '/symbols/', '/symbols/GOLD', '/symbols/CRM', '/trades', '/trades/abc',
    '/backtest', '/login', '/welcome', '/studiox', '/database'])
    assert.equal(blockedForGuest(p), false, p);
});

test('masking replaces names in order and drops inputs, values and rules', () => {
  const parts = [
    { node: 'CRM/SILVER_GRADE', input: 'CRM/SILVER', value: 4.2, score: 4, rule: 'CRM/SILVER against bands' },
    { node: 'M2SL/CRM_GRADE', input: 'M2SL/CRM', value: 0.097, score: 5, rule: 'M2SL/CRM against bands' },
  ];
  const m = maskParts(parts);
  assert.deepEqual(m.map((p) => p.node), ['Indicator 1', 'Indicator 2']);
  assert.deepEqual(m.map((p) => p.score), [4, 5]);
  assert.ok(m.every((p) => p.input === null && p.value === null && p.rule === ''));
  assert.ok(!JSON.stringify(m).includes('M2SL') && !JSON.stringify(m).includes('SILVER'));
});
