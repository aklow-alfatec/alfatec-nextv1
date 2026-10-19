'use server';

import { revalidatePath } from 'next/cache';
import { addAsset, deleteAsset, recentValues, updateAsset, upsertCsv, upsertManual, type AssetInput, type CsvRow, type ManualRow } from '@/lib/assets';
import { engineCall } from '@/lib/engine-server';
import { requireAdmin } from '@/lib/session-user';
import { currentViewer } from '@/lib/viewer';

export interface RecomputeResult {
  start_friday: string;
  end_friday: string;
  weeks: number;
  pipelines: { pipeline: string; symbol: string; ok: boolean; rows?: number; error?: string }[];
  notified: { notified_symbols?: string[]; emailed?: boolean; error?: string };
}

type Res<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function wrap<T>(fn: () => Promise<T>, ...paths: string[]): Promise<Res<T>> {
  try {
    const data = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addAssetAction(a: AssetInput) {
  return wrap(async () => { await requireAdmin(); await addAsset(a); }, '/data');
}
export async function updateAssetAction(symbol: string, a: Omit<AssetInput, 'symbol'>) {
  return wrap(async () => { await requireAdmin(); await updateAsset(symbol, a); }, '/data');
}
export async function deleteAssetAction(symbol: string) {
  return wrap(async () => { await requireAdmin(); await deleteAsset(symbol); }, '/data');
}

export async function recentValuesAction(symbol: string) {
  const v = await currentViewer();
  if (!v || v.guest) return [];
  return symbol ? recentValues(symbol) : [];
}

/** Save prices, then re-run the active pipelines that use those symbols (backend /pipelines/recompute). */
async function saveAndRecompute(kind: 'manual' | 'csv', rows: ManualRow[] | CsvRow[], notify: boolean) {
  await requireAdmin();
  const n = kind === 'manual' ? await upsertManual(rows as ManualRow[]) : await upsertCsv(rows as CsvRow[]);
  const dates = rows.map((r) => r.date).sort();
  let recompute: RecomputeResult | { error: string };
  try {
    recompute = await engineCall<RecomputeResult>('/pipelines/recompute', {
      symbols: [...new Set(rows.map((r) => r.symbol))], start: dates[0], end: dates[dates.length - 1], notify,
    });
  } catch (e) {
    recompute = { error: `prices saved, but grades were not recomputed: ${(e as Error).message}` };
  }
  return { saved: n, recompute };
}

export async function saveManualAction(rows: ManualRow[], notify: boolean) {
  return wrap(() => saveAndRecompute('manual', rows, notify), '/data', '/', '/grades');
}
export async function saveCsvAction(rows: CsvRow[], notify: boolean) {
  return wrap(() => saveAndRecompute('csv', rows, notify), '/data', '/', '/grades');
}
