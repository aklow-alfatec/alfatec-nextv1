// Password rules (lib/passwords.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_LENGTH, passwordProblem } from '../lib/passwords.ts';

test('accepts a reasonable password', () => {
  assert.equal(passwordProblem('blue-river-42-kite', 'ann@example.com'), null);
  assert.equal(MIN_LENGTH, 10);
});

test('refuses short, email-like, common and repetitive passwords', () => {
  assert.match(passwordProblem('short1', 'ann@example.com')!, /at least 10/);
  assert.match(passwordProblem('ann@example.com', 'Ann@Example.com')!, /email/);
  assert.match(passwordProblem('annabelle1', 'annabelle1@example.com')!, /email/);
  assert.match(passwordProblem('Password123', 'x@y.co')!, /common/);
  assert.match(passwordProblem('aaaaabbbbb', 'x@y.co')!, /different characters/);
  assert.match(passwordProblem('x'.repeat(201), 'x@y.co')!, /too long/);
});
