import sql from '@/lib/db';
import { NewTradeForm } from './new-trade-form';

export const dynamic = 'force-dynamic';

export default async function NewTradePage() {
  // nextv0 offers every pipeline's symbol (active or not)
  const rows = await sql<{ symbol: string }[]>`SELECT DISTINCT pipelinedata->>'symbol' AS symbol FROM pipeline ORDER BY 1`;
  return <NewTradeForm symbols={rows.map((r) => r.symbol).filter(Boolean)} />;
}
