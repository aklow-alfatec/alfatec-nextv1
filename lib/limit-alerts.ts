// Server-side only. Limit-breach alerts written by the backend's Friday job (table limit_alerts, migration M14).
import sql from '@/lib/db';
import { DEFAULT_CHECK_DATA_ABOVE, DEFAULT_RANGE, sortBreaches, type BreachRow } from '@/lib/limit-alert-rules';

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : new Date(d).toISOString().slice(0, 10));

/** The breaches stored for one Friday (empty before the migration). */
export async function limitBreaches(week: string): Promise<BreachRow[]> {
  const rows = await sql<{
    week: Date; symbol: string; pipeline: string | null; node: string; pair: string; side: 'cheap' | 'expensive';
    value: number; limit_value: number; alert_level: number; excess: number; scaling: string; first_breach_week: Date;
    is_new: boolean; check_data: boolean; alert_range: number;
  }[]>`SELECT week, symbol, pipeline, node, pair, side, value, limit_value, alert_level, excess, scaling,
          first_breach_week, is_new, check_data, alert_range
        FROM limit_alerts WHERE week = ${week}`.catch(() => []);
  return sortBreaches(rows.map((r) => ({
    week: iso(r.week), symbol: r.symbol, pipeline: r.pipeline, node: r.node, pair: r.pair, side: r.side,
    value: Number(r.value), limitValue: Number(r.limit_value), alertLevel: Number(r.alert_level), excess: Number(r.excess),
    scaling: r.scaling, firstBreachWeek: iso(r.first_breach_week), isNew: r.is_new, checkData: r.check_data,
    alertRange: Number(r.alert_range),
  })));
}

export interface LimitAlertSettings {
  range: number;
  checkDataAbove: number;
  updatedAt: string | null;
  updatedBy: string | null;
  /** active pipelines with their per-pipeline override (null = the global range) */
  pipelines: { name: string; symbol: string; alertRange: number | null }[];
}

export async function limitAlertSettings(): Promise<LimitAlertSettings> {
  const [kv, pipes] = await Promise.all([
    sql<{ key: string; value: unknown; updated_at: Date; updated_by: string | null }[]>`
      SELECT key, value, updated_at, updated_by FROM app_settings WHERE key LIKE 'limit_alert.%'`.catch(() => []),
    sql<{ name: string; symbol: string; alert_range: number | null }[]>`
      SELECT name, symbol, alert_range FROM pipeline WHERE active = TRUE ORDER BY symbol`.catch(() => []),
  ]);
  const get = (k: string, d: number) => {
    const v = Number(kv.find((r) => r.key === k)?.value);
    return Number.isFinite(v) ? v : d;
  };
  const latest = [...kv].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0];
  return {
    range: get('limit_alert.range', DEFAULT_RANGE),
    checkDataAbove: get('limit_alert.check_data_above', DEFAULT_CHECK_DATA_ABOVE),
    updatedAt: latest ? new Date(latest.updated_at).toISOString() : null,
    updatedBy: latest?.updated_by ?? null,
    pipelines: pipes.map((p) => ({ name: p.name, symbol: p.symbol, alertRange: p.alert_range === null ? null : Number(p.alert_range) })),
  };
}

export async function saveLimitAlertSettings(range: number, checkDataAbove: number, by: string) {
  await sql`
    INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES
      ('limit_alert.range', ${JSON.stringify(range)}::jsonb, now(), ${by}),
      ('limit_alert.check_data_above', ${JSON.stringify(checkDataAbove)}::jsonb, now(), ${by})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`;
}

/** null clears the override (the pipeline uses the global range). */
export async function savePipelineAlertRange(name: string, range: number | null) {
  const rows = await sql`UPDATE pipeline SET alert_range = ${range} WHERE name = ${name} AND active = TRUE RETURNING name`;
  if (!rows.length) throw new Error(`No active pipeline ${name}`);
}
