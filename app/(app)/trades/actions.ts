'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { closeTrade, createTrade, deleteClosure, deleteTrade, priceOn, updateClosure, updateNotes } from '@/lib/trades';
import { upsertRiskReward, type RiskRewardRow } from '@/lib/risk-reward';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function uid(): Promise<string> {
  const s = await auth();
  const id = (s?.user as { id?: string } | undefined)?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

async function run(fn: (userId: string) => Promise<string | void>, ...paths: string[]): Promise<ActionResult> {
  try {
    const id = await fn(await uid());
    for (const p of paths) revalidatePath(p);
    return { ok: true, ...(id ? { id } : {}) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function priceOnAction(symbol: string, date: string): Promise<number | null> {
  await uid();
  return symbol && date ? priceOn(symbol, date) : null;
}

export async function createTradeAction(input: Parameters<typeof createTrade>[1]) {
  return run((u) => createTrade(u, input), '/trades');
}

export async function closeTradeAction(tradeId: string, input: Parameters<typeof closeTrade>[2]) {
  return run((u) => closeTrade(tradeId, u, input), '/trades', `/trades/${tradeId}`);
}

export async function updateClosureAction(tradeId: string, closureId: string, input: Parameters<typeof updateClosure>[3]) {
  return run((u) => updateClosure(tradeId, closureId, u, input), '/trades', `/trades/${tradeId}`);
}

export async function deleteClosureAction(tradeId: string, closureId: string) {
  return run((u) => deleteClosure(tradeId, closureId, u), '/trades', `/trades/${tradeId}`);
}

export async function updateNotesAction(tradeId: string, notes: string) {
  return run((u) => updateNotes(tradeId, u, notes), `/trades/${tradeId}`);
}

export async function deleteTradeAction(tradeId: string) {
  return run((u) => deleteTrade(tradeId, u), '/trades');
}

export async function saveRiskRewardAction(rows: RiskRewardRow[]) {
  return run((u) => upsertRiskReward(rows, u), '/trades');
}
