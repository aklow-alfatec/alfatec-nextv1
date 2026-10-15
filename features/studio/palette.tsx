'use client';

import React, { useMemo, useState } from 'react';
import { DTYPE_COLOR, type BlockSpec } from './types';

export const DRAG_MIME = 'application/x-engine-block';

export default function Palette({
  blocks,
  onAdd,
}: {
  blocks: BlockSpec[];
  onAdd: (spec: BlockSpec) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const m = new Map<string, BlockSpec[]>();
    for (const b of blocks) {
      if (needle && !`${b.type} ${b.label} ${b.category} ${b.description}`.toLowerCase().includes(needle)) continue;
      if (!m.has(b.category)) m.set(b.category, []);
      m.get(b.category)!.push(b);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [blocks, q]);

  return (
    <div className="flex h-full flex-col">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${blocks.length} blocks...`}
        className="mb-2 w-full rounded border border-line-2 bg-bg text-fg px-2 py-1 text-sm"
      />
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="text-xs text-fg-3">No blocks match.</p>}
        {groups.map(([cat, items]) => {
          const expanded = q.trim() ? true : open[cat] ?? false;
          return (
            <div key={cat} className="mb-1">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [cat]: !expanded }))}
                className="flex w-full items-center justify-between rounded bg-raised px-2 py-1 text-left text-xs font-semibold text-fg hover:bg-line"
              >
                <span>{cat}</span>
                <span className="text-fg-3">
                  {items.length} {expanded ? '-' : '+'}
                </span>
              </button>
              {expanded &&
                items.map((b) => (
                  <div
                    key={b.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, b.type);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDoubleClick={() => onAdd(b)}
                    title={`${b.type}\n${b.description}\n(drag onto the canvas, or double-click)`}
                    className="mt-1 cursor-grab rounded border border-line bg-surface px-2 py-1 text-xs hover:border-accent active:cursor-grabbing"
                  >
                    <div className="font-medium text-fg">{b.label}</div>
                    <div className="flex items-center gap-1 text-[10px] text-fg-3">
                      <span className="truncate">{b.type}</span>
                      <span className="ml-auto flex gap-0.5">
                        {Object.values(b.inputs).slice(0, 4).map((p, i) => (
                          <i key={`i${i}`} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: DTYPE_COLOR[p.dtype] }} />
                        ))}
                        <span>{'>'}</span>
                        {Object.values(b.outputs).slice(0, 4).map((p, i) => (
                          <i key={`o${i}`} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: DTYPE_COLOR[p.dtype] }} />
                        ))}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
