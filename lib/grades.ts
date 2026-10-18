import sql from './db';
import { sectionOf, type SectionKey } from './sections';
import { readingInfo } from './grade-zones';

/** Server-side only (imports the database). Grades from `daily_indicator_json`, as nextv0 shows them:
 *  grade   = share of the maximum score, 0..100, from the `<X>_DAILY_GRADE` node {value, max}
 *            (same rule as nextv0 backtests and app/services/nextv0_backtest.grade_from_indicator_json);
 *            higher = more undervalued
 *  reading = the `<SYMBOL>_DAILY_IND` sentiment, -3 (extremely undervalued) .. +3 (extremely overvalued)
 */

export interface ActivePipeline {
  name: string;
  symbol: string;
  title: string;           // GOLD_V2A -> GOLD (nextv0 card title)
  tags: string[];
  assetType: string | null; // assets.asset_type of the symbol
  section: SectionKey;      // dashboard section (lib/sections.ts)
}

export interface GradeCell {
  date: string;            // the row's date (a Friday, or the latest row on / before it)
  grade: number | null;
  reading: number | null;
}

/** nextv0 reading label (see lib/grade-zones.ts). */
export function readingLabel(r: number | null | undefined): string {
  return readingInfo(r).label;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : new Date(d).toISOString().slice(0, 10));
const parse = (j: unknown) => (typeof j === 'string' ? JSON.parse(j) : j) as { nodes?: Record<string, unknown> } | null;
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** grade 0..100 from a daily_indicator_json payload (nextv0 backtest rule). */
export function gradeFromJson(payload: unknown): number | null {
  const p = parse(payload);
  const nodes = (p?.nodes && typeof p.nodes === 'object' ? p.nodes : (p as Record<string, unknown>)) ?? {};
  const keys = Object.keys(nodes);
  const found = keys.filter((k) => k.endsWith('GRADE') && !k.endsWith('DAILY_GRADE')).length;
  let value = 0;
  let max = 0;
  let hasMax = false;
  for (const k of keys.filter((x) => x.endsWith('_DAILY_GRADE'))) {
    const v = nodes[k];
    if (v && typeof v === 'object') {
      value = num((v as Record<string, unknown>).value) ?? 0;
      if ('max' in (v as object)) {
        max = num((v as Record<string, unknown>).max) ?? 0;
        hasMax = true;
      }
    } else {
      value = num(v) ?? 0;
    }
  }
  if (!hasMax && found > 0) {
    max = found * 5;
    hasMax = true;
  }
  return hasMax && max > 0 ? (value / max) * 100 : null;
}

export function readingFromJson(payload: unknown, symbol: string): number | null {
  return num(parse(payload)?.nodes?.[`${symbol}_DAILY_IND`]);
}

export async function activePipelines(): Promise<ActivePipeline[]> {
  const rows = await sql<{ pipelinedata: unknown; tags: string[] | null; asset_type: string | null }[]>`
    SELECT p.pipelinedata, p.tags, a.asset_type FROM pipeline p
    LEFT JOIN assets a ON a.symbol = p.pipelinedata->>'symbol'
    WHERE p.active = TRUE`;
  return rows
    .map((r) => {
      const d = (typeof r.pipelinedata === 'string' ? JSON.parse(r.pipelinedata) : r.pipelinedata) as { name: string; symbol: string };
      const tags = r.tags ?? [];
      return { name: d.name, symbol: d.symbol, title: d.name.split('_')[0] || d.symbol, tags, assetType: r.asset_type,
        section: sectionOf(r.asset_type, tags) };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Last Friday whose grades are final: on a Friday the week's run is not in yet, so use the previous one. */
export function lastFinalFriday(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const back = (d.getUTCDay() + 2) % 7; // days since the last Friday (0 on Friday)
  d.setUTCDate(d.getUTCDate() - (back === 0 ? 7 : back));
  return d.toISOString().slice(0, 10);
}

/** `weeks` Fridays ending at `end` (oldest first). */
export function fridays(end: string, weeks: number): string[] {
  const out: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  for (let i = weeks - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - 7 * i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

/** Grade and reading per symbol and Friday; a Friday without a row uses the latest row in the 6 days before it. */
export async function weeklyGrades(symbols: string[], weeks: string[]): Promise<Record<string, Record<string, GradeCell>>> {
  const out: Record<string, Record<string, GradeCell>> = Object.fromEntries(symbols.map((s) => [s, {}]));
  if (!symbols.length || !weeks.length) return out;
  const first = new Date(`${weeks[0]}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - 6);
  const rows = await sql<{ symbol: string; date: Date; jsondata: unknown }[]>`
    SELECT symbol, date, jsondata FROM daily_indicator_json
    WHERE symbol IN ${sql(symbols)} AND date >= ${first.toISOString().slice(0, 10)} AND date <= ${weeks[weeks.length - 1]}
    ORDER BY symbol, date`;
  const bySym = new Map<string, { date: string; jsondata: unknown }[]>();
  for (const r of rows) {
    const list = bySym.get(r.symbol) ?? [];
    list.push({ date: iso(r.date), jsondata: r.jsondata });
    bySym.set(r.symbol, list);
  }
  for (const s of symbols) {
    const list = bySym.get(s) ?? [];
    for (const w of weeks) {
      const lo = new Date(`${w}T00:00:00Z`);
      lo.setUTCDate(lo.getUTCDate() - 6);
      const loS = lo.toISOString().slice(0, 10);
      const hit = [...list].reverse().find((r) => r.date <= w && r.date >= loS);
      if (hit) out[s][w] = { date: hit.date, grade: gradeFromJson(hit.jsondata), reading: readingFromJson(hit.jsondata, s) };
    }
  }
  return out;
}

/** Latest row per symbol on or before `maxDate` (the nextv0 overview cards). */
export async function latestGrades(symbols: string[], maxDate: string): Promise<Record<string, GradeCell>> {
  if (!symbols.length) return {};
  const rows = await sql<{ symbol: string; date: Date; jsondata: unknown }[]>`
    SELECT t.symbol, t.date, t.jsondata
    FROM (SELECT symbol, MAX(date) AS max_date FROM daily_indicator_json
          WHERE symbol IN ${sql(symbols)} AND date <= ${maxDate} GROUP BY symbol) m
    JOIN daily_indicator_json t ON t.symbol = m.symbol AND t.date = m.max_date`;
  return Object.fromEntries(rows.map((r) => [r.symbol, { date: iso(r.date), grade: gradeFromJson(r.jsondata), reading: readingFromJson(r.jsondata, r.symbol) }]));
}

/** Full JSON payload (all node values) for one symbol and date (symbol page breakdown). */
export async function gradeJson(symbol: string, date: string): Promise<{ date: string; nodes: Record<string, unknown> } | null> {
  const rows = await sql<{ date: Date; jsondata: unknown }[]>`
    SELECT date, jsondata FROM daily_indicator_json WHERE symbol = ${symbol} AND date <= ${date}
    ORDER BY date DESC LIMIT 1`;
  if (!rows.length) return null;
  const p = parse(rows[0].jsondata);
  return { date: iso(rows[0].date), nodes: (p?.nodes ?? {}) as Record<string, unknown> };
}

/** Colour band for a 0..100 grade (Grades page legend). */
export function gradeBand(g: number | null): string {
  if (g === null) return 'bg-line text-fg-3';
  if (g >= 80) return 'bg-positive/30 text-fg';
  if (g >= 60) return 'bg-positive/15 text-fg';
  if (g >= 40) return 'bg-raised text-fg-2';
  if (g >= 20) return 'bg-negative/15 text-fg';
  return 'bg-negative/30 text-fg';
}

export interface NodeChange {
  symbol: string;
  node: string;
  from: number | null;
  to: number | null;
}

/** Component grades (nodes ending `_GRADE`, 1..5) that changed between two Fridays (nextv0 changes monitor). */
export async function componentChanges(symbols: string[], prev: string, cur: string): Promise<NodeChange[]> {
  if (!symbols.length) return [];
  const rows = await sql<{ symbol: string; date: Date; jsondata: unknown }[]>`
    SELECT symbol, date, jsondata FROM daily_indicator_json
    WHERE symbol IN ${sql(symbols)} AND date IN ${sql([prev, cur])}`;
  const by = new Map<string, Record<string, unknown>>();
  for (const r of rows) by.set(`${r.symbol}|${iso(r.date)}`, (parse(r.jsondata)?.nodes ?? {}) as Record<string, unknown>);
  const g = (v: unknown) => (v && typeof v === 'object' ? num((v as Record<string, unknown>).grade) : null);
  const out: NodeChange[] = [];
  for (const s of symbols) {
    const a = by.get(`${s}|${prev}`) ?? {};
    const b = by.get(`${s}|${cur}`) ?? {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!k.endsWith('_GRADE') || k.endsWith('DAILY_GRADE')) continue;
      const from = g(a[k]);
      const to = g(b[k]);
      if (from !== to) out.push({ symbol: s, node: k, from, to });
    }
  }
  return out;
}
