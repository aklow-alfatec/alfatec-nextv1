'use client';

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { DTYPE_COLOR, type EngineNode, type Issue, inHandle, outHandle } from './types';

function PortRow({
  side,
  name,
  dtype,
  optional,
  variadic,
  doc,
  issues,
}: {
  side: 'in' | 'out';
  name: string;
  dtype: keyof typeof DTYPE_COLOR;
  optional?: boolean;
  variadic?: boolean;
  doc?: string;
  issues: Issue[];
}) {
  const bad = issues.some((i) => i.level === 'error');
  const warn = !bad && issues.length > 0;
  const color = DTYPE_COLOR[dtype] ?? 'rgb(var(--text-3))';
  const title = [`${name}: ${dtype}${variadic ? ' (many)' : ''}${optional ? ' (optional)' : ''}`, doc, ...issues.map((i) => i.message)]
    .filter(Boolean)
    .join('\n');
  return (
    <div
      className={`relative flex items-center gap-1 py-0.5 text-[11px] ${side === 'in' ? 'justify-start pl-3 pr-1' : 'justify-end pl-1 pr-3'}`}
      title={title}
    >
      <Handle
        type={side === 'in' ? 'target' : 'source'}
        position={side === 'in' ? Position.Left : Position.Right}
        id={side === 'in' ? inHandle(name) : outHandle(name)}
        isConnectable
        style={{
          background: color,
          width: variadic ? 12 : 10,
          height: variadic ? 12 : 10,
          borderRadius: variadic ? 3 : 999,
          border: bad ? '2px solid rgb(var(--negative))' : warn ? '2px solid rgb(var(--warning))' : '1px solid rgb(var(--surface))',
        }}
      />
      <span className={bad ? 'font-semibold text-negative' : warn ? 'text-warning' : 'text-fg'}>
        {name}
        {variadic ? '[]' : ''}
        {optional ? '?' : ''}
      </span>
      <span className="text-[9px]" style={{ color }}>
        {dtype}
      </span>
    </div>
  );
}

export default function EngineNodeView({ id, data, selected }: NodeProps<EngineNode>) {
  const issues = data.issues ?? [];
  const nodeLevel = issues.some((i) => i.level === 'error') ? 'error' : issues.length ? 'warning' : null;
  const portIssues = (port: string) => issues.filter((i) => i.port === port);
  const nodeOnly = issues.filter((i) => !i.port || (!(i.port in data.spec.inputs) && !(i.port in data.spec.outputs)));
  const border =
    nodeLevel === 'error' ? 'border-negative' : nodeLevel === 'warning' ? 'border-warning' : selected ? 'border-accent' : 'border-line-2 bg-bg text-fg';

  return (
    <div className={`min-w-[190px] max-w-[260px] rounded-md border-2 bg-surface shadow-sm ${border}`}>
      <div className="rounded-t bg-raised px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-fg">{data.spec.label}</span>
          <span className="shrink-0 text-[9px] uppercase tracking-wide text-fg-3">{data.spec.category.split('/').pop()}</span>
        </div>
        <div className="truncate text-[10px] text-fg-3">
          {id} · {data.blockType}
          {data.unknownBlock ? ' (unknown block)' : ''}
        </div>
      </div>
      <div className="flex justify-between gap-2 py-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {Object.entries(data.spec.inputs).map(([n, p]) => (
            <PortRow key={n} side="in" name={n} dtype={p.dtype} optional={p.optional} variadic={p.variadic} doc={p.doc} issues={portIssues(n)} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-end">
          {Object.entries(data.spec.outputs).map(([n, p]) => (
            <PortRow key={n} side="out" name={n} dtype={p.dtype} doc={p.doc} issues={portIssues(n)} />
          ))}
        </div>
      </div>
      {nodeOnly.length > 0 && (
        <ul className="border-t px-2 py-1 text-[10px]">
          {nodeOnly.slice(0, 3).map((i, k) => (
            <li key={k} className={i.level === 'error' ? 'text-negative' : 'text-warning'}>
              {i.message}
            </li>
          ))}
          {nodeOnly.length > 3 && <li className="text-fg-3">+{nodeOnly.length - 3} more (see Issues)</li>}
        </ul>
      )}
    </div>
  );
}
