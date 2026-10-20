'use server';

import { revalidatePath } from 'next/cache';
import { currentViewer } from '@/lib/viewer';
import { BACKTEST_TAG, setRunName, setRunTag } from '@/lib/studio-db';

/** Show a run on the Backtest page or take it off (the ViewInBacktest tag). Returns the run's tags. */
export async function setBacktestAction(runId: string, on: boolean): Promise<{ ok: true; tags: string[] } | { ok: false; error: string }> {
  const v = await currentViewer();
  if (!v) return { ok: false, error: 'Not signed in' };
  if (v.guest) return { ok: false, error: 'Not available on this account' };
  try {
    const tags = await setRunTag(runId, BACKTEST_TAG, on);
    if (!tags) return { ok: false, error: 'Run not found' };
    revalidatePath('/backtest');
    return { ok: true, tags };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Name a run (shown under the graph name on Runs and Backtest, and on the run page); empty clears it. */
export async function setRunNameAction(runId: string, name: string): Promise<{ ok: true; tags: string[] } | { ok: false; error: string }> {
  const v = await currentViewer();
  if (!v) return { ok: false, error: 'Not signed in' };
  if (v.guest) return { ok: false, error: 'Not available on this account' };
  try {
    const tags = await setRunName(runId, name);
    if (!tags) return { ok: false, error: 'Run not found' };
    revalidatePath('/backtest');
    return { ok: true, tags };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
