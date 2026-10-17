// Local / cloud engine switching (lib/engine-base.ts). Run: npm test
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';
import { engineTarget, isAlfatecEngine, resetEngineTarget } from '../lib/engine-base.ts';

let healthy: Server, other: Server;
const url = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
const listen = (s: Server) => new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r()));

before(async () => {
  healthy = createServer((_q, res) => res.end(JSON.stringify({ status: 'healthy', service: 'alfatec-backend', version: '1.0.0' })));
  other = createServer((_q, res) => res.end(JSON.stringify({ status: 'healthy', service: 'something-else' })));
  await Promise.all([listen(healthy), listen(other)]);
});
after(() => {
  healthy.close();
  other.close();
});
beforeEach(() => {
  resetEngineTarget();
  process.env.ENGINE_API_URL = 'https://engine.example.run.app/';
  process.env.ENGINE_API_SECRET = 'cloud-secret';
  delete process.env.ENGINE_LOCAL_URL;
  delete process.env.ENGINE_LOCAL_SECRET;
});

test('only an alfatec-backend health answer counts', async () => {
  assert.equal(await isAlfatecEngine(url(healthy)), true);
  assert.equal(await isAlfatecEngine(url(other)), false);
  assert.equal(await isAlfatecEngine('http://127.0.0.1:1'), false);
});

test('local backend answering: use it', async () => {
  process.env.ENGINE_LOCAL_URL = `${url(healthy)}/`;
  process.env.ENGINE_LOCAL_SECRET = 'local-secret';
  assert.deepEqual(await engineTarget(), { base: url(healthy), secret: 'local-secret', source: 'local' });
});

test('local not answering, or not ours: cloud', async () => {
  process.env.ENGINE_LOCAL_URL = 'http://127.0.0.1:1';
  assert.deepEqual(await engineTarget(), { base: 'https://engine.example.run.app', secret: 'cloud-secret', source: 'cloud' });
  resetEngineTarget();
  process.env.ENGINE_LOCAL_URL = url(other);
  assert.equal((await engineTarget()).source, 'cloud');
});

test('no ENGINE_LOCAL_URL (Vercel): cloud without probing', async () => {
  assert.equal((await engineTarget()).source, 'cloud');
});

test('nothing configured: a clear error', async () => {
  delete process.env.ENGINE_API_URL;
  process.env.ENGINE_LOCAL_URL = 'http://127.0.0.1:1';
  await assert.rejects(engineTarget(), /not answering and ENGINE_API_URL is not configured/);
});
