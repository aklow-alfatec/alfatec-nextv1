import postgres from 'postgres';

// Reads, plus the writes the nextv0 pages did (trades, closures, risk-reward, assets, manual entry, users),
// always from server actions that check the session first.
const globalForSql = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

const sql =
  globalForSql.__sql ??
  postgres((process.env.POSTGRES_URL || process.env.DATABASE_URL) as string, {
    ssl: process.env.PGSSLMODE === 'disable' ? undefined : 'require',
    max: parseInt(process.env.PGPOOL_MAX || '1', 10),
    idle_timeout: 20,
    max_lifetime: 3600,
  });
if (!globalForSql.__sql) globalForSql.__sql = sql;
export default sql;
