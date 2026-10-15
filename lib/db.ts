import postgres from 'postgres';

// Read-only usage only: this app never writes to the database.
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
