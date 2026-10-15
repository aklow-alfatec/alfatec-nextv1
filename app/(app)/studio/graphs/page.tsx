'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { engineApi } from '@/features/studio/api';
import type { GraphMeta } from '@/features/studio/types';

export default function GraphsPage() {
  const [rows, setRows] = useState<GraphMeta[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    engineApi.list().then(setRows).catch((e: Error) => {
      setError(e.message);
      setRows([]);
    });
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Graphs</h1>
        <Link href="/studio/graphs/new">
          <Button variant="primary">New graph</Button>
        </Link>
      </div>
      <Card>
        {error && <p className="mb-3 text-sm text-negative">{error}</p>}
        {rows === null ? (
          <p className="text-sm text-fg-3">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-fg-3">No saved graphs yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Symbol</TH>
                <TH>Legacy</TH>
                <TH>Status</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((g) => (
                <TR key={g.id}>
                  <TD>
                    <Link className="text-accent hover:underline" href={`/studio/graphs/${g.id}`}>
                      {g.name}
                    </Link>
                  </TD>
                  <TD>{g.symbol ?? '-'}</TD>
                  <TD>{g.legacy_pipeline ?? '-'}</TD>
                  <TD>{g.active ? <Badge tone="positive">active</Badge> : <Badge>draft</Badge>}</TD>
                  <TD className="num text-fg-3">{g.updated_at?.slice(0, 16).replace('T', ' ')}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
