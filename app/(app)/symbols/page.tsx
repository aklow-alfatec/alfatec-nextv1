import Link from 'next/link';
import { currentViewer } from '@/lib/viewer';
import { Card, GradeChip, ReadingTag, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import sql from '@/lib/db';
import { activePipelines, lastFinalFriday, latestGrades } from '@/lib/grades';

export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const guest = (await currentViewer())?.guest ?? true; // guests see the list without the graph names
  const pipes = await activePipelines();
  const symbols = pipes.map((p) => p.symbol);
  const [grades, closes] = await Promise.all([
    latestGrades(symbols, lastFinalFriday()),
    symbols.length
      ? sql<{ symbol: string; date: Date; close: string; name: string | null }[]>`
          SELECT x.symbol, x.date, x.last_close AS close, a.name
          FROM unnest(${sql.array(symbols)}::text[]) AS u(sym)
          CROSS JOIN LATERAL (SELECT symbol, date, last_close FROM stock_data WHERE symbol = u.sym ORDER BY date DESC LIMIT 1) x
          LEFT JOIN assets a ON a.symbol = x.symbol`
      : Promise.resolve([]),
  ]);
  const close = new Map(closes.map((c) => [c.symbol, c]));
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Assets</h1>
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Asset</TH>
              <TH>Name</TH>
              {!guest && <TH>Graph</TH>}
              <TH>Grade</TH>
              <TH>Reading</TH>
              <TH align="right">Last close</TH>
            </TR>
          </THead>
          <TBody>
            {pipes.map((p) => {
              const g = grades[p.symbol];
              const c = close.get(p.symbol);
              return (
                <TR key={p.symbol}>
                  <TD><Link href={`/symbols/${encodeURIComponent(p.symbol)}`} className="font-semibold text-accent hover:underline">{p.symbol}</Link></TD>
                  <TD className="text-fg-2">{c?.name ?? '-'}</TD>
                  {!guest && <TD className="text-fg-2">{p.name}</TD>}
                  <TD><GradeChip grade={g?.grade ?? null} /></TD>
                  <TD><ReadingTag reading={g?.reading} /></TD>
                  <TD num className="text-right">{c ? Number(c.close).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
