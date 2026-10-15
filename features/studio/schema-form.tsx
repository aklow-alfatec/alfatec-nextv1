'use client';

import React, { useEffect, useState } from 'react';
import type { JsonSchema } from './types';

type Kind = 'integer' | 'number' | 'string' | 'boolean' | 'enum' | 'numarray' | 'json';

interface Field {
  kind: Kind;
  nullable: boolean;
  schema: JsonSchema;
  enumValues?: unknown[];
}

function resolve(s: JsonSchema, defs: Record<string, JsonSchema>): JsonSchema {
  if (s.$ref) {
    const name = s.$ref.split('/').pop() ?? '';
    return { ...(defs[name] ?? {}), ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== '$ref')) };
  }
  return s;
}

const isNum = (t: unknown) => t === 'integer' || t === 'number';

/** Reduce a property schema (anyOf with null, $ref, arrays...) to a field kind the form can render. */
export function classify(raw: JsonSchema, defs: Record<string, JsonSchema>): Field {
  let s = resolve(raw, defs);
  let nullable = false;
  const alts = s.anyOf ?? s.oneOf;
  if (alts) {
    const nonNull = alts.map((a) => resolve(a, defs)).filter((a) => a.type !== 'null');
    nullable = nonNull.length !== alts.length;
    if (nonNull.length === 1) {
      s = { ...nonNull[0], description: s.description ?? nonNull[0].description, default: s.default ?? nonNull[0].default, title: s.title };
    } else if (nonNull.length > 1 && nonNull.every((a) => isNum(a.type))) {
      s = { ...s, anyOf: undefined, type: nonNull.every((a) => a.type === 'integer') ? 'integer' : 'number' };
    } else {
      return { kind: 'json', nullable, schema: s };
    }
  }
  if (s.enum) return { kind: 'enum', nullable, schema: s, enumValues: s.enum };
  if (s.type === 'boolean') return { kind: 'boolean', nullable, schema: s };
  if (s.type === 'integer') return { kind: 'integer', nullable, schema: s };
  if (s.type === 'number') return { kind: 'number', nullable, schema: s };
  if (s.type === 'string') return { kind: 'string', nullable, schema: s };
  if (s.type === 'array' && s.items) {
    const it = classify(s.items, defs);
    if (it.kind === 'integer' || it.kind === 'number') return { kind: 'numarray', nullable, schema: s };
  }
  return { kind: 'json', nullable, schema: s };
}

const inputCls = 'w-full rounded border border-line-2 bg-bg text-fg px-2 py-1 text-xs';

function NumberInput({ value, integer, onCommit, placeholder, schema }: {
  value: unknown;
  integer: boolean;
  onCommit: (v: number | undefined) => void;
  placeholder?: string;
  schema: JsonSchema;
}) {
  const [draft, setDraft] = useState(value === undefined || value === null ? '' : String(value));
  useEffect(() => {
    setDraft((d) => (Number(d) === value && d.trim() !== '' ? d : value === undefined || value === null ? '' : String(value)));
  }, [value]);
  const min = schema.minimum ?? schema.exclusiveMinimum;
  const max = schema.maximum ?? schema.exclusiveMaximum;
  return (
    <input
      type="number"
      className={inputCls}
      value={draft}
      step={integer ? 1 : 'any'}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        if (t.trim() === '') return onCommit(undefined);
        const n = Number(t);
        if (Number.isFinite(n)) onCommit(integer ? Math.trunc(n) : n);
      }}
    />
  );
}

function NumArrayInput({ value, onCommit }: { value: unknown; onCommit: (v: number[] | undefined) => void }) {
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');
  const [draft, setDraft] = useState(fmt(value));
  const [err, setErr] = useState('');
  useEffect(() => {
    setDraft((d) => {
      const parsed = d.split(/[,\s]+/).filter(Boolean).map(Number);
      return JSON.stringify(parsed) === JSON.stringify(value) ? d : fmt(value);
    });
  }, [value]);
  return (
    <>
      <input
        className={inputCls}
        value={draft}
        placeholder="comma separated numbers"
        onChange={(e) => {
          const t = e.target.value;
          setDraft(t);
          const parts = t.split(/[,\s]+/).filter(Boolean);
          const nums = parts.map(Number);
          if (nums.some((n) => !Number.isFinite(n))) return setErr('numbers only');
          setErr('');
          onCommit(parts.length ? nums : undefined);
        }}
      />
      {err && <p className="text-[10px] text-negative">{err}</p>}
    </>
  );
}

function JsonInput({ value, onCommit }: { value: unknown; onCommit: (v: unknown) => void }) {
  const fmt = (v: unknown) => (v === undefined ? '' : JSON.stringify(v, null, 2));
  const [draft, setDraft] = useState(fmt(value));
  const [err, setErr] = useState('');
  useEffect(() => {
    setDraft((d) => {
      try {
        return JSON.stringify(JSON.parse(d)) === JSON.stringify(value) ? d : fmt(value);
      } catch {
        return d === '' && value === undefined ? d : fmt(value);
      }
    });
  }, [value]);
  return (
    <>
      <textarea
        className={`${inputCls} font-mono`}
        rows={Math.min(10, Math.max(3, draft.split('\n').length))}
        value={draft}
        placeholder="JSON"
        onChange={(e) => {
          const t = e.target.value;
          setDraft(t);
          if (t.trim() === '') {
            setErr('');
            return onCommit(undefined);
          }
          try {
            onCommit(JSON.parse(t));
            setErr('');
          } catch (ex) {
            setErr(`invalid JSON: ${(ex as Error).message}`);
          }
        }}
      />
      {err && <p className="text-[10px] text-negative">{err}</p>}
    </>
  );
}

export default function SchemaForm({
  schema,
  values,
  onChange,
}: {
  schema: JsonSchema;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const defs = schema.$defs ?? {};
  const props = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);

  const set = (k: string, v: unknown) => {
    const next = { ...values };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next);
  };

  if (props.length === 0) return <p className="text-xs text-fg-3">This block has no parameters.</p>;

  return (
    <div className="space-y-3">
      {props.map(([key, raw]) => {
        const f = classify(raw, defs);
        const def = raw.default ?? f.schema.default;
        const isSet = key in values;
        const value = isSet ? values[key] : undefined;
        const shown = isSet ? value : def;
        const desc = raw.description ?? f.schema.description;
        const hint = def === undefined ? '' : `default: ${JSON.stringify(def)}`;
        // a block can offer a starting value (x-template); reset fills it in instead of clearing the field
        const template = raw['x-template'] ?? f.schema['x-template'];
        const atTemplate = template !== undefined && JSON.stringify(value) === JSON.stringify(template);
        return (
          <div key={key}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-fg" title={key}>
                {raw.title ?? key}
                {required.has(key) && <span className="text-negative"> *</span>}
                <span className="ml-1 font-normal text-fg-3">{key}</span>
              </label>
              {(isSet || template !== undefined) && !atTemplate && (
                <button
                  type="button"
                  className="text-[10px] text-accent hover:underline"
                  title={template !== undefined ? 'Replace with the template' : undefined}
                  onClick={() => set(key, template !== undefined ? structuredClone(template) : undefined)}
                >
                  {template !== undefined ? 'reset to template' : 'reset'}
                </button>
              )}
            </div>
            {f.kind === 'boolean' && (
              <input type="checkbox" checked={Boolean(shown)} onChange={(e) => set(key, e.target.checked)} className="mt-1" />
            )}
            {(f.kind === 'integer' || f.kind === 'number') && (
              <NumberInput
                value={value}
                integer={f.kind === 'integer'}
                schema={f.schema}
                placeholder={def === undefined ? (f.nullable ? 'none' : '') : String(def)}
                onCommit={(v) => set(key, v)}
              />
            )}
            {f.kind === 'string' && (
              <input
                className={inputCls}
                value={typeof value === 'string' ? value : ''}
                placeholder={typeof def === 'string' ? def : f.nullable ? 'none' : ''}
                onChange={(e) => set(key, e.target.value === '' ? undefined : e.target.value)}
              />
            )}
            {f.kind === 'enum' && (
              <select
                className={inputCls}
                value={shown === undefined || shown === null ? '' : String(shown)}
                onChange={(e) => {
                  const picked = (f.enumValues ?? []).find((o) => String(o) === e.target.value);
                  set(key, picked);
                }}
              >
                {(f.nullable || def === undefined) && <option value="">{def === undefined ? '(unset)' : ''}</option>}
                {(f.enumValues ?? []).map((o) => (
                  <option key={String(o)} value={String(o)}>
                    {String(o)}
                  </option>
                ))}
              </select>
            )}
            {f.kind === 'numarray' && <NumArrayInput value={value} onCommit={(v) => set(key, v)} />}
            {f.kind === 'json' && <JsonInput value={value} onCommit={(v) => set(key, v)} />}
            {desc && <p className="mt-0.5 text-[10px] text-fg-3">{desc}</p>}
            {hint && !isSet && f.kind !== 'boolean' && f.kind !== 'enum' && <p className="text-[10px] text-fg-3">{hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
