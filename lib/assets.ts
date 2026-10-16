import sql from './db';

/** Server-side only. Assets, their data coverage, manual / CSV price entry and users (nextv0 admin pages). */

export interface AssetRow {
  symbol: string;
  name: string;
  asset_type: string;
  category: string;
  inst_id: number;
  pull_method: string;
  publication_lag_days: number | null;
  datasources: unknown;
  first_date: string | null;
  last_date: string | null;
  rows: number;
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export async function listAssets(): Promise<AssetRow[]> {
  const rows = await sql<(Omit<AssetRow, 'first_date' | 'last_date' | 'rows'> & { first_date: Date | null; last_date: Date | null; rows: string | null })[]>`
    SELECT a.symbol, a.name, a.asset_type, a.category, a.inst_id, a.pull_method, a.publication_lag_days, a.datasources,
           s.first_date, s.last_date, s.rows
    FROM assets a
    LEFT JOIN (SELECT symbol, MIN(date) AS first_date, MAX(date) AS last_date, COUNT(*) AS rows FROM stock_data GROUP BY symbol) s
      ON s.symbol = a.symbol
    ORDER BY a.symbol`;
  return rows.map((r) => ({ ...r, first_date: iso(r.first_date), last_date: iso(r.last_date), rows: Number(r.rows ?? 0) }));
}

/** Expected age of the latest row, by how the asset is pulled (for the "behind" flag). Monthly series count
 *  their publication lag: M2 for August (dated 1 Aug, published ~55 days later) is the latest one until late October. */
export function expectedDays(a: Pick<AssetRow, 'pull_method' | 'symbol' | 'publication_lag_days'>): number {
  if (a.pull_method === 'fred' || ['M2SL', 'FRED_CPIAUCSL', 'FRED_GACDFSA066MSFRBPHI'].includes(a.symbol)) return 31 + (a.publication_lag_days ?? 20) + 7;
  if (a.pull_method === 'cftc' || a.symbol === 'NAAIM' || a.symbol.startsWith('COT_')) return 10;
  if (a.pull_method === 'manual') return 35;
  return 5;
}

export type AssetInput = { symbol: string; name: string; asset_type: string; category: string; inst_id: number; pull_method: string; publication_lag_days: number | null };

function check(a: AssetInput) {
  if (!/^[A-Z0-9_./^=-]{1,40}$/i.test(a.symbol)) throw new Error('Symbol: letters, digits and _ . / ^ = - only');
  if (!a.name || !a.asset_type || !a.category || !a.pull_method) throw new Error('Fill in name, type, category and pull method');
  if (!Number.isFinite(a.inst_id)) throw new Error('inst_id must be a number (0 if unused)');
}

export async function addAsset(a: AssetInput) {
  check(a);
  const dup = await sql`SELECT 1 FROM assets WHERE symbol = ${a.symbol}`;
  if (dup.length) throw new Error('Symbol already exists');
  await sql`INSERT INTO assets (symbol, name, asset_type, category, inst_id, pull_method, publication_lag_days)
    VALUES (${a.symbol}, ${a.name}, ${a.asset_type}, ${a.category}, ${a.inst_id}, ${a.pull_method}, ${a.publication_lag_days})`;
}

/** Edit an asset. The symbol is not renamed here: stock_data, pipelines and graphs refer to it. */
export async function updateAsset(symbol: string, a: Omit<AssetInput, 'symbol'>) {
  check({ ...a, symbol });
  const r = await sql`UPDATE assets SET name = ${a.name}, asset_type = ${a.asset_type}, category = ${a.category}, inst_id = ${a.inst_id},
    pull_method = ${a.pull_method}, publication_lag_days = ${a.publication_lag_days} WHERE symbol = ${symbol}`;
  if (!r.count) throw new Error('Asset not found');
}

/** Delete the asset row only (as nextv0); its price rows stay in stock_data. */
export async function deleteAsset(symbol: string) {
  await sql`DELETE FROM assets WHERE symbol = ${symbol}`;
}

export type ManualRow = { symbol: string; date: string; value: number };
export type CsvRow = { symbol: string; date: string; open: number; high: number; low: number; close: number };

function validRows<T extends { symbol: string; date: string }>(rows: T[], nums: (r: T) => number[]) {
  const bad = rows.filter((r) => !r.symbol || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || nums(r).some((v) => !Number.isFinite(v)));
  if (bad.length) throw new Error(`${bad.length} row(s) need a symbol, a yyyy-mm-dd date and numbers (first: ${JSON.stringify(bad[0])})`);
}

/** nextv0 manual entry: one value per day written to open / high / low / close, volume 0, id = SYMBOL_date. */
export async function upsertManual(rows: ManualRow[]) {
  validRows(rows, (r) => [r.value]);
  const v = rows.map((r) => r.value);
  await sql`
    INSERT INTO stock_data (id, symbol, date, last_close, last_open, last_max, last_min, volume)
    SELECT * FROM UNNEST(${rows.map((r) => `${r.symbol}_${r.date}`)}::text[], ${rows.map((r) => r.symbol)}::text[],
      ${rows.map((r) => r.date)}::timestamp[], ${v}::decimal[], ${v}::decimal[], ${v}::decimal[], ${v}::decimal[], ${rows.map(() => 0)}::bigint[])
    ON CONFLICT (id) DO UPDATE SET last_close = EXCLUDED.last_close, last_open = EXCLUDED.last_open, last_max = EXCLUDED.last_max,
      last_min = EXCLUDED.last_min, volume = EXCLUDED.volume`;
  return rows.length;
}

/** nextv0 CSV upload: open / high / low / close per day, volume 0. */
export async function upsertCsv(rows: CsvRow[]) {
  validRows(rows, (r) => [r.open, r.high, r.low, r.close]);
  await sql`
    INSERT INTO stock_data (id, symbol, date, last_open, last_max, last_min, last_close, volume)
    SELECT * FROM UNNEST(${rows.map((r) => `${r.symbol}_${r.date}`)}::text[], ${rows.map((r) => r.symbol)}::text[],
      ${rows.map((r) => r.date)}::timestamp[], ${rows.map((r) => r.open)}::decimal[], ${rows.map((r) => r.high)}::decimal[],
      ${rows.map((r) => r.low)}::decimal[], ${rows.map((r) => r.close)}::decimal[], ${rows.map(() => 0)}::bigint[])
    ON CONFLICT (id) DO UPDATE SET last_open = EXCLUDED.last_open, last_max = EXCLUDED.last_max, last_min = EXCLUDED.last_min,
      last_close = EXCLUDED.last_close, volume = EXCLUDED.volume`;
  return rows.length;
}

/** Recent values of one symbol (shown next to the manual entry form). */
export async function recentValues(symbol: string, n = 10) {
  const rows = await sql<{ date: Date; close: string }[]>`SELECT date, last_close AS close FROM stock_data WHERE symbol = ${symbol} ORDER BY date DESC LIMIT ${n}`;
  return rows.map((r) => ({ date: iso(r.date)!, close: Number(r.close) }));
}

export interface UserRow { id: string; name: string | null; email: string; role: string | null }

export async function listUsers(): Promise<UserRow[]> {
  return sql<UserRow[]>`SELECT id::text, name, email, role FROM users ORDER BY name ASC`;
}

export async function setUserRole(email: string, role: string) {
  await sql`UPDATE users SET role = ${role} WHERE email = ${email}`;
}

export async function removeUser(email: string) {
  await sql`DELETE FROM users WHERE email = ${email}`;
}
