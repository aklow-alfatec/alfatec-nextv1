'use client';

import { Button } from '@/components/ui';

/** Downloads the grade grid shown on the page as CSV (built in the browser; nothing is sent anywhere). */
export function ExportCsv({ weeks, rows, filename }: { weeks: string[]; rows: { symbol: string; grades: (number | null)[]; reading: string }[]; filename: string }) {
  const download = () => {
    const head = ['symbol', ...weeks, 'reading'].join(',');
    const body = rows.map((r) => [r.symbol, ...r.grades.map((g) => (g === null ? '' : g.toFixed(2))), `"${r.reading}"`].join(','));
    const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return <Button onClick={download}>Export CSV</Button>;
}
