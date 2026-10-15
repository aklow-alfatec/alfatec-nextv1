'use client';
import { useState } from 'react';
import {
  Badge, Button, Card, GradeChip, Input, Segmented, Select, Sparkline, StatusPill, Table, TBody, TD, TH, THead, TR, Tabs,
} from '@/components/ui';

const swatches = ['bg', 'surface', 'raised', 'line', 'line-2', 'accent', 'positive', 'negative', 'info', 'warning'];

export default function UiGallery() {
  const [seg, setSeg] = useState('1y');
  const [tab, setTab] = useState('a');
  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Component gallery</h1>
      <Card title="Tokens">
        <div className="flex flex-wrap gap-3">
          {swatches.map((s) => (
            <div key={s} className="w-24">
              <div className="h-10 rounded-control border border-line-2" style={{ background: `rgb(var(--${s}))` }} />
              <div className="num mt-1 text-[11px] text-fg-3">{s}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Card>
      <Card title="Inputs">
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Input placeholder="Text input" />
          <Select defaultValue="1W">
            <option>1D</option>
            <option>1W</option>
            <option>1M</option>
          </Select>
          <Segmented value={seg} onChange={setSeg} options={[{ value: '3m', label: '3M' }, { value: '1y', label: '1Y' }, { value: 'all', label: 'All' }]} />
        </div>
      </Card>
      <Card title="Tabs, badges, pills">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'a', label: 'Properties' }, { value: 'b', label: 'Issues' }, { value: 'c', label: 'Run' }]} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge><Badge tone="accent">Accent</Badge><Badge tone="positive">Positive</Badge>
          <Badge tone="negative">Negative</Badge><Badge tone="info">Info</Badge><Badge tone="warning">Warning</Badge>
          <StatusPill status="fresh" label="Prices" detail="2h" />
          <StatusPill status="stale" label="COT" detail="9d" />
          <StatusPill status="error" label="Macro" detail="failed" />
        </div>
      </Card>
      <Card title="Grades and table">
        <div className="mb-3 flex gap-2">
          {[10, 30, 50, 70, 90, null].map((g, i) => <GradeChip key={i} grade={g} />)}
        </div>
        <Table>
          <THead><TR><TH>Symbol</TH><TH>Grade</TH><TH align="right">Price</TH><TH>Trend</TH></TR></THead>
          <TBody>
            {[['GOLD', 82, 2341.5, [1, 3, 2, 5, 4, 6]], ['EURUSD', 35, 1.0834, [5, 4, 4, 3, 2, 2]], ['WTI', 61, 78.12, [2, 3, 3, 4, 3, 5]]].map(([s, g, p, d]) => (
              <TR key={s as string}>
                <TD>{s as string}</TD><TD><GradeChip grade={g as number} /></TD>
                <TD num>{(p as number).toLocaleString()}</TD>
                <TD><Sparkline data={d as number[]} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
