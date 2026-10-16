import sql from './db';

/** Server-side only. Read-only view of nextv0's saved backtests (trading_backtests, backtest_groups; FR-105). */

export interface OldBacktestRow {
  id: string;
  name: string;
  pipeline_id: string;
  start_date: string | null;
  end_date: string | null;
  initial_fund: number | null;
  pnl_value: number | null;
  pnl_percentage: number | null;
  buy_count: number | null;
  sell_count: number | null;
  average_drawdown: number | null;
  status: string | null;
  created_at: string;
  group_id: string | null;
  group_name: string | null;
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

type Raw = Omit<OldBacktestRow, 'start_date' | 'end_date' | 'created_at'> & { start_date: Date | null; end_date: Date | null; created_at: Date };
const toRow = (r: Raw): OldBacktestRow => ({
  ...r, name: (r.name ?? '').trim(), start_date: iso(r.start_date), end_date: iso(r.end_date), created_at: new Date(r.created_at).toISOString(),
  initial_fund: num(r.initial_fund), pnl_value: num(r.pnl_value), pnl_percentage: num(r.pnl_percentage), buy_count: num(r.buy_count),
  sell_count: num(r.sell_count), average_drawdown: num(r.average_drawdown),
});

export async function listOldBacktests(f: { pipeline?: string; group?: string; q?: string }): Promise<OldBacktestRow[]> {
  const rows = await sql<Raw[]>`
    SELECT b.id::text, b.name, b.pipeline_id, b.start_date, b.end_date, b.initial_fund, b.pnl_value, b.pnl_percentage, b.buy_count,
           b.sell_count, b.average_drawdown, b.status, b.created_at, b.group_id::text, g.name AS group_name
    FROM trading_backtests b LEFT JOIN backtest_groups g ON g.id = b.group_id
    WHERE TRUE
      ${f.pipeline ? sql`AND b.pipeline_id = ${f.pipeline}` : sql``}
      ${f.group ? sql`AND b.group_id::text = ${f.group}` : sql``}
      ${f.q ? sql`AND b.name ILIKE ${`%${f.q}%`}` : sql``}
    ORDER BY b.created_at DESC`;
  return rows.map(toRow);
}

export async function oldBacktestFilters(): Promise<{ pipelines: string[]; groups: { id: string; name: string; n: number }[] }> {
  const [p, g] = await Promise.all([
    sql<{ pipeline_id: string }[]>`SELECT DISTINCT pipeline_id FROM trading_backtests ORDER BY 1`,
    sql<{ id: string; name: string; n: string }[]>`
      SELECT g.id::text, g.name, COUNT(b.id) AS n FROM backtest_groups g LEFT JOIN trading_backtests b ON b.group_id = g.id
      GROUP BY g.id, g.name ORDER BY g.name`,
  ]);
  return { pipelines: p.map((r) => r.pipeline_id), groups: g.map((r) => ({ id: r.id, name: r.name, n: Number(r.n) })) };
}

export interface OldBacktestDetail extends OldBacktestRow {
  policy_config: unknown;
  remark: string | null;
  error_message: string | null;
  summary: Record<string, unknown>;
  transactions: { date: string; type: string; amount: number; price: number; details?: string }[];
  curve: { index: string[]; equity: (number | null)[]; benchmark: (number | null)[] | null; drawdown: (number | null)[]; grade: (number | null)[] };
  points: number;
}

/** One saved backtest with its curve thinned to at most `maxPoints` rows (buy-and-hold from the stored prices). */
export async function getOldBacktest(id: string, maxPoints = 800): Promise<OldBacktestDetail | null> {
  const rows = await sql<(Raw & { policy_config: unknown; remark: string | null; error_message: string | null; result_data: unknown })[]>`
    SELECT b.id::text, b.name, b.pipeline_id, b.start_date, b.end_date, b.initial_fund, b.pnl_value, b.pnl_percentage, b.buy_count,
           b.sell_count, b.average_drawdown, b.status, b.created_at, b.group_id::text, g.name AS group_name,
           b.policy_config, b.remark, b.error_message, b.result_data
    FROM trading_backtests b LEFT JOIN backtest_groups g ON g.id = b.group_id WHERE b.id::text = ${id}`;
  if (!rows.length) return null;
  const r = rows[0];
  const rd = (typeof r.result_data === 'string' ? JSON.parse(r.result_data) : r.result_data) as
    { daily_positions?: { date: string; total_value: number; price: number; grade: number }[]; transactions?: OldBacktestDetail['transactions']; summary?: Record<string, unknown> } | null;
  const dp = rd?.daily_positions ?? [];
  const n = dp.length;
  const keep = n <= maxPoints ? dp.map((_, i) => i) : Array.from(new Set(Array.from({ length: maxPoints }, (_, k) => Math.round((k * (n - 1)) / (maxPoints - 1)))));
  let peak = -Infinity;
  const dd = dp.map((p) => {
    peak = Math.max(peak, p.total_value);
    return peak > 0 ? p.total_value / peak - 1 : 0;
  });
  const p0 = dp.find((p) => p.price > 0)?.price;
  const eq0 = dp[0]?.total_value ?? num(r.initial_fund) ?? 0;
  return {
    ...toRow(r),
    policy_config: typeof r.policy_config === 'string' ? JSON.parse(r.policy_config) : r.policy_config,
    remark: r.remark,
    error_message: r.error_message,
    summary: rd?.summary ?? {},
    transactions: rd?.transactions ?? [],
    points: n,
    curve: {
      index: keep.map((i) => dp[i].date),
      equity: keep.map((i) => dp[i].total_value),
      benchmark: p0 ? keep.map((i) => (dp[i].price > 0 ? (dp[i].price / p0) * eq0 : null)) : null,
      drawdown: keep.map((i) => dd[i]),
      grade: keep.map((i) => (Number.isFinite(dp[i].grade) ? dp[i].grade : null)),
    },
  };
}
