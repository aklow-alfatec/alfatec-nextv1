'use client';
import { useState } from 'react';
import { setRunNameAction } from '@/app/(app)/studio/runs/actions';

/** A run's name (its `name:` tag) next to the run page title; click to add or change it. */
export function RunName({ runId, tags, onSaved }: { runId: string; tags: string[]; onSaved: (tags: string[]) => void }) {
  const current = tags.find((t) => t.startsWith('name:'))?.slice(5) ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (draft.trim() === current) return setEditing(false);
    setBusy(true);
    const res = await setRunNameAction(runId, draft);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setError('');
    setEditing(false);
    onSaved(res.tags);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className={`rounded-chip px-2 py-0.5 text-[11px] ${current ? 'bg-[#EA7A12]/15 font-medium text-[#EA7A12]' : 'border border-dashed border-line-2 text-fg-3'} hover:opacity-80`}
        title="The run's name, shown on Runs and Backtest. Click to change."
        onClick={() => {
          setDraft(current);
          setEditing(true);
        }}
      >
        {current || '+ name'}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="e.g. SET2-8"
        className="w-40 rounded border border-line-2 bg-bg px-1.5 py-0.5 text-xs text-fg"
      />
      <button type="button" className="text-xs text-accent hover:underline disabled:opacity-50" disabled={busy} onClick={() => void save()}>save</button>
      <button type="button" className="text-xs text-fg-3 hover:underline" onClick={() => setEditing(false)}>cancel</button>
      {error && <span className="text-xs text-negative">{error}</span>}
    </span>
  );
}
