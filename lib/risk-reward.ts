import sql from './db';

/** Server-side only. Risk / reward notes per symbol (table risk_reward_summary, as nextv0). */
export type Bias = 'NONE' | 'LONG' | 'SHORT';

export interface RiskRewardRow {
  symbol: string;
  date: string;
  potential_bias: Bias;
  potential_risk: number;           // %
  potential_reward: number;         // %
  potential_risk_reward_ratio: string;
  estimated_position_duration: number; // months
}

export async function latestRiskReward(symbols: string[]): Promise<RiskRewardRow[]> {
  if (!symbols.length) return [];
  return sql<RiskRewardRow[]>`
    SELECT DISTINCT ON (symbol) symbol, to_char(date, 'YYYY-MM-DD') AS date, potential_bias,
           potential_risk::float8 AS potential_risk, potential_reward::float8 AS potential_reward,
           potential_risk_reward_ratio, estimated_position_duration::float8 AS estimated_position_duration
    FROM risk_reward_summary WHERE symbol IN ${sql(symbols)} ORDER BY symbol, date DESC`;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a || 1);

/** Ratio text exactly as nextv0's table works it out: both rounded up, then reduced (risk 10, reward 25 -> "2:5").
 *  Null when either is not above 0 (the previous ratio is kept). */
export function ratioText(risk: number, reward: number): string | null {
  const a = Math.ceil(risk);
  const b = Math.ceil(reward);
  if (!(a > 0 && b > 0)) return null;
  const g = gcd(a, b);
  return `${Math.floor(a / g)}:${Math.floor(b / g)}`;
}

export async function upsertRiskReward(rows: RiskRewardRow[], editor: string): Promise<void> {
  const clean = rows
    .filter((r) => r.symbol && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .map((r) => [r.symbol, r.date, ['LONG', 'SHORT'].includes(r.potential_bias) ? r.potential_bias : 'NONE', Number(r.potential_risk) || 0,
      Number(r.potential_reward) || 0,
      ratioText(Number(r.potential_risk) || 0, Number(r.potential_reward) || 0) ?? (r.potential_risk_reward_ratio || '1:1'),
      Number(r.estimated_position_duration) || 0, editor]);
  if (!clean.length) throw new Error('Nothing to save');
  await sql`
    INSERT INTO risk_reward_summary (symbol, date, potential_bias, potential_risk, potential_reward, potential_risk_reward_ratio,
                                     estimated_position_duration, edited_by)
    VALUES ${sql(clean as never)}
    ON CONFLICT (symbol, date) DO UPDATE SET potential_bias = EXCLUDED.potential_bias, potential_risk = EXCLUDED.potential_risk,
      potential_reward = EXCLUDED.potential_reward, potential_risk_reward_ratio = EXCLUDED.potential_risk_reward_ratio,
      estimated_position_duration = EXCLUDED.estimated_position_duration, edited_by = EXCLUDED.edited_by, edited_at = NOW()`;
}
