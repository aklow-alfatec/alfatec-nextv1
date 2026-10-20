// Which engine API calls start the GitHub backtest worker (lib/worker-dispatch.ts). Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queuesJob, startWorker } from '../lib/worker-dispatch.ts';

test('only queueing a backtest or an experiment starts the worker', () => {
  assert.ok(queuesJob('POST', ['runs']));
  assert.ok(queuesJob('post', ['experiments']));
  for (const [m, p] of [['GET', ['runs']], ['POST', ['runs', 'abc', 'stop']], ['POST', ['graphs']], ['POST', ['runs', 'x', 'indicators']], ['PUT', ['experiments']]] as const)
    assert.equal(queuesJob(m, [...p]), false, `${m} ${p.join('/')}`);
});

test('without a token nothing is started', async () => {
  const keep = process.env.GITHUB_DISPATCH_TOKEN;
  delete process.env.GITHUB_DISPATCH_TOKEN;
  assert.deepEqual(await startWorker(), { started: false, detail: 'GITHUB_DISPATCH_TOKEN not set' });
  if (keep !== undefined) process.env.GITHUB_DISPATCH_TOKEN = keep;
});
