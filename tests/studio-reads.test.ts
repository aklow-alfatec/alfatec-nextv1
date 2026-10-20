// Which studio requests are answered from the database (P20) and which still go to the engine API. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { servedFromDb } from '../features/studio/api.ts';

const ID = '1b55fe48-c603-4346-bb83-e086862804a9';

test('read-only studio paths come from the database', () => {
  for (const p of [
    '/graphs', `/graphs/${ID}`, `/graphs/${ID}/versions`, `/graphs/${ID}/versions/3`,
    '/runs', `/runs?graph_id=${ID}&limit=500`, `/runs/${ID}/status`, `/runs/${ID}?include_series=false&events_limit=0`,
    '/experiments', `/experiments?graph_id=${ID}`, `/experiments/${ID}`, `/experiments/${ID}/status`,
  ]) assert.ok(servedFromDb(p), p);
});

test('run series, catalogue and download links come from Storage via /api/studio-db', () => {
  for (const p of [`/runs/${ID}/series-catalogue`, `/runs/${ID}?columns=PRICE.close&max_points=1500&events_limit=0&exports=false`,
    `/runs/${ID}?include_series=false&events_limit=0&exports=true`]) assert.equal(servedFromDb(p), true, p);
});

test('computing and every write stay on the engine API', () => {
  for (const p of ['/blocks', '/edges/stats']) assert.equal(servedFromDb(p), false, p);
  for (const [p, m] of [['/graphs', 'POST'], [`/graphs/${ID}`, 'PUT'], [`/graphs/${ID}`, 'DELETE'], ['/graphs/validate', 'POST'],
    ['/graphs/run-preview', 'POST'], ['/runs', 'POST'], ['/experiments', 'POST'], [`/runs/${ID}/stop`, 'POST'],
    [`/runs/${ID}/indicators?max_points=1500`, 'POST']] as const) assert.equal(servedFromDb(p, m), false, `${m} ${p}`);
});
