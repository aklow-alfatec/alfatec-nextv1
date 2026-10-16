import { randomUUID } from 'crypto';
import sql from './db';
import { gradeFromJson } from './grades';

/** Server-side only. Trades and closures, ported from nextv0 app/lib/trades.ts (same tables, same P&L rules).
 *  Everyone signed in can read every trade; only the trade's owner can change it. */

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  entry_date: string;
  entry_price: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  notes: string | null;
  created_at: string;
  notional: boolean;
  notional_value: number | null;
}

export interface Closure {
  id: string;
  trade_id: string;
  close_date: string;
  close_price: number;
  quantity_closed: number;
  notes: string | null;
  created_at: string;
  custom_pl: number | null;
}

export interface TradeView extends Trade {
  remaining_quantity: number;
  realized_pnl: number;
  unrealized_pnl: number;
  latest_price: number | null;
  closures: Closure[];
  is_closed: boolean;
  user_name: string | null;
  user_email: string | null;
  open_signal: number | null;   // DAILY_IND reading in the week before entry
  entry_grade: number | null;   // grade 0..100 in the week before entry
  amount: number;               // notional value, or quantity x entry price
}

const iso = (d: Date | string | null) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : '');
const n = (v: unknown) => Number(v);

type TradeRow = { id: string; user_id: string; symbol: string; entry_date: Date; entry_price: string; quantity: string; side: string | null;
  notes: string | null; created_at: Date; notional: boolean | null; notional_value: string | null; email: string | null; name: string | null };

function toTrade(r: TradeRow): Trade {
  return { id: r.id, user_id: r.user_id, symbol: r.symbol, entry_date: iso(r.entry_date), entry_price: n(r.entry_price), quantity: n(r.quantity),
    side: r.side === 'SHORT' ? 'SHORT' : 'LONG', notes: r.notes, created_at: new Date(r.created_at).toISOString(),
    notional: !!r.notional, notional_value: r.notional_value === null ? null : n(r.notional_value) };
}

/** nextv0 computeForTrade: realized from closures (custom P&L wins), unrealized on the remaining quantity at the latest close. */
export function compute(t: Trade, closures: Closure[], latest: number | null) {
  const closed = closures.reduce((a, c) => a + c.quantity_closed, 0);
  const remaining = t.quantity - closed;
  const short = t.side === 'SHORT';
  const realized = closures.reduce((a, c) => a + (c.custom_pl !== null ? c.custom_pl : c.quantity_closed * (short ? t.entry_price - c.close_price : c.close_price - t.entry_price)), 0);
  const unrealized = remaining > 0 && latest !== null ? remaining * (short ? t.entry_price - latest : latest - t.entry_price) : 0;
  return { remaining_quantity: remaining, realized_pnl: realized, unrealized_pnl: unrealized, latest_price: latest, closures, is_closed: remaining <= 0 };
}

async function closuresFor(ids: string[]): Promise<Closure[]> {
  if (!ids.length) return [];
  const rows = await sql<{ id: string; trade_id: string; close_date: Date; close_price: string; quantity_closed: string; notes: string | null; created_at: Date; custom_pl: string | null }[]>`
    SELECT id, trade_id, close_date, close_price, quantity_closed, notes, created_at, custom_pl
    FROM trade_closures WHERE trade_id = ANY(${ids}::text[]) ORDER BY close_date ASC`;
  return rows.map((c) => ({ id: c.id, trade_id: c.trade_id, close_date: iso(c.close_date), close_price: n(c.close_price), quantity_closed: n(c.quantity_closed),
    notes: c.notes, created_at: new Date(c.created_at).toISOString(), custom_pl: c.custom_pl === null ? null : n(c.custom_pl) }));
}

async function latestPrices(symbols: string[]): Promise<Record<string, number | null>> {
  if (!symbols.length) return {};
  const rows = await sql<{ symbol: string; last_close: string }[]>`
    SELECT DISTINCT ON (symbol) symbol, last_close FROM stock_data WHERE symbol IN ${sql(symbols)} ORDER BY symbol, date DESC`;
  const out: Record<string, number | null> = Object.fromEntries(symbols.map((s) => [s, null]));
  for (const r of rows) out[r.symbol] = n(r.last_close);
  return out;
}

async function openSignals(trades: Trade[]): Promise<Record<string, { reading: number | null; grade: number | null }>> {
  const out: Record<string, { reading: number | null; grade: number | null }> = {};
  await Promise.all(trades.map(async (t) => {
    const lo = new Date(`${t.entry_date}T00:00:00Z`);
    lo.setUTCDate(lo.getUTCDate() - 7);
    const rows = await sql<{ jsondata: unknown }[]>`
      SELECT jsondata FROM daily_indicator_json WHERE symbol = ${t.symbol} AND date <= ${t.entry_date} AND date >= ${lo.toISOString().slice(0, 10)}
      ORDER BY date DESC LIMIT 1`;
    const j = rows.length ? (typeof rows[0].jsondata === 'string' ? JSON.parse(rows[0].jsondata) : rows[0].jsondata) : null;
    const v = j?.nodes?.[`${t.symbol}_DAILY_IND`];
    out[t.id] = { reading: v === null || v === undefined ? null : n(v), grade: j ? gradeFromJson(j) : null };
  }));
  return out;
}

export async function listTrades(): Promise<TradeView[]> {
  const rows = await sql<TradeRow[]>`
    SELECT t.id, t.user_id, t.symbol, t.entry_date, t.entry_price, t.quantity, t.side, t.notes, t.created_at, t.notional, t.notional_value, u.email, u.name
    FROM trades t LEFT JOIN users u ON t.user_id = u.id::text WHERE t.deleted IS NOT TRUE ORDER BY t.created_at DESC`;
  const trades = rows.map(toTrade);
  const [closures, latest, signals] = await Promise.all([closuresFor(trades.map((t) => t.id)), latestPrices([...new Set(trades.map((t) => t.symbol))]), openSignals(trades)]);
  return trades.map((t, i) => ({ ...t, ...compute(t, closures.filter((c) => c.trade_id === t.id), latest[t.symbol] ?? null),
    user_email: rows[i].email, user_name: rows[i].name, open_signal: signals[t.id]?.reading ?? null, entry_grade: signals[t.id]?.grade ?? null,
    amount: t.notional_value ?? t.quantity * t.entry_price }));
}

export async function getTrade(id: string): Promise<TradeView | null> {
  const rows = await sql<TradeRow[]>`
    SELECT t.id, t.user_id, t.symbol, t.entry_date, t.entry_price, t.quantity, t.side, t.notes, t.created_at, t.notional, t.notional_value, u.email, u.name
    FROM trades t LEFT JOIN users u ON t.user_id = u.id::text WHERE t.id = ${id} AND t.deleted IS NOT TRUE LIMIT 1`;
  if (!rows.length) return null;
  const t = toTrade(rows[0]);
  const [closures, latest, signals] = await Promise.all([closuresFor([id]), latestPrices([t.symbol]), openSignals([t])]);
  return { ...t, ...compute(t, closures, latest[t.symbol] ?? null), user_email: rows[0].email, user_name: rows[0].name,
    open_signal: signals[id]?.reading ?? null, entry_grade: signals[id]?.grade ?? null, amount: t.notional_value ?? t.quantity * t.entry_price };
}

/** Latest close on or before `date` (auto-filled entry / close price). */
export async function priceOn(symbol: string, date: string): Promise<number | null> {
  const rows = await sql<{ last_close: string }[]>`
    SELECT last_close FROM stock_data WHERE symbol = ${symbol} AND date <= ${date}::timestamp ORDER BY date DESC LIMIT 1`;
  return rows.length ? n(rows[0].last_close) : null;
}

export async function createTrade(userId: string, input: { symbol: string; entry_date: string; entry_price: number; quantity: number; side: 'LONG' | 'SHORT';
  notes?: string; notional?: boolean; notional_value?: number | null }): Promise<string> {
  if (!input.symbol || !input.entry_date || !Number.isFinite(input.entry_price) || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Fill in symbol, entry date, a numeric price and a positive quantity');
  }
  const id = randomUUID();
  await sql`INSERT INTO trades (id, user_id, symbol, entry_date, entry_price, quantity, side, notes, notional, notional_value)
    VALUES (${id}, ${userId}, ${input.symbol}, ${input.entry_date}, ${input.entry_price}, ${input.quantity}, ${input.side === 'SHORT' ? 'SHORT' : 'LONG'},
            ${input.notes || null}, ${!!input.notional}, ${input.notional_value ?? null})`;
  return id;
}

async function owned(tradeId: string, userId: string) {
  const rows = await sql<{ user_id: string; quantity: string; deleted: boolean | null }[]>`SELECT user_id, quantity, deleted FROM trades WHERE id = ${tradeId} LIMIT 1`;
  if (!rows.length || rows[0].deleted) throw new Error('Trade not found');
  if (rows[0].user_id !== userId) throw new Error('Only the person who entered this trade can change it');
  return { quantity: n(rows[0].quantity) };
}

export async function closeTrade(tradeId: string, userId: string, input: { close_date: string; close_price: number; quantity: number; notes?: string; custom_pl?: number | null }) {
  const { quantity } = await owned(tradeId, userId);
  if (!input.close_date || !Number.isFinite(input.close_price) || !Number.isFinite(input.quantity)) throw new Error('Fill in close date, price and quantity');
  const closed = (await closuresFor([tradeId])).reduce((a, c) => a + c.quantity_closed, 0);
  const remaining = quantity - closed;
  if (remaining <= 0) throw new Error('Trade already fully closed');
  if (input.quantity <= 0 || input.quantity > remaining) throw new Error(`Closure quantity must be above 0 and at most the remaining ${remaining}`);
  await sql`INSERT INTO trade_closures (id, trade_id, close_date, close_price, quantity_closed, notes, custom_pl)
    VALUES (${randomUUID()}, ${tradeId}, ${input.close_date}, ${input.close_price}, ${input.quantity}, ${input.notes || null}, ${input.custom_pl ?? null})`;
}

export async function updateClosure(tradeId: string, closureId: string, userId: string,
  input: { close_date?: string; close_price?: number; quantity?: number; notes?: string; custom_pl?: number | null }) {
  const { quantity } = await owned(tradeId, userId);
  const all = await closuresFor([tradeId]);
  if (!all.some((c) => c.id === closureId)) throw new Error('Closure not found');
  if (input.quantity !== undefined) {
    const others = all.filter((c) => c.id !== closureId).reduce((a, c) => a + c.quantity_closed, 0);
    if (input.quantity <= 0 || input.quantity > quantity - others) throw new Error(`Invalid quantity; at most ${quantity - others}`);
  }
  if (input.close_date !== undefined) await sql`UPDATE trade_closures SET close_date = ${input.close_date} WHERE id = ${closureId}`;
  if (input.close_price !== undefined) await sql`UPDATE trade_closures SET close_price = ${input.close_price} WHERE id = ${closureId}`;
  if (input.quantity !== undefined) await sql`UPDATE trade_closures SET quantity_closed = ${input.quantity} WHERE id = ${closureId}`;
  if (input.notes !== undefined) await sql`UPDATE trade_closures SET notes = ${input.notes} WHERE id = ${closureId}`;
  if (input.custom_pl !== undefined) await sql`UPDATE trade_closures SET custom_pl = ${input.custom_pl} WHERE id = ${closureId}`;
}

export async function deleteClosure(tradeId: string, closureId: string, userId: string) {
  await owned(tradeId, userId);
  await sql`DELETE FROM trade_closures WHERE id = ${closureId} AND trade_id = ${tradeId}`;
}

export async function updateNotes(tradeId: string, userId: string, notes: string) {
  await owned(tradeId, userId);
  await sql`UPDATE trades SET notes = ${notes} WHERE id = ${tradeId}`;
}

/** Soft delete, as nextv0 (the row stays with deleted = true). */
export async function deleteTrade(tradeId: string, userId: string) {
  await owned(tradeId, userId);
  await sql`UPDATE trades SET deleted = true WHERE id = ${tradeId}`;
}

/** Portfolio figures of the nextv0 trades page (realized P&L on a nominal 10,000 fund, risk-free 4.2%). */
export function tradeStats(trades: TradeView[]) {
  const fund = 10000;
  const rf = 0.042;
  const rets = trades.map((t) => t.realized_pnl / fund);
  const total = trades.reduce((a, t) => a + t.realized_pnl, 0);
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const variance = rets.length > 1 ? rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1) : 0;
  const times = trades.map((t) => Date.parse(t.entry_date || t.created_at)).filter((x) => !Number.isNaN(x));
  const days = Math.max(((times.length ? Math.max(...times) : Date.now()) - (times.length ? Math.min(...times) : Date.now())) / 864e5, 1);
  const years = Math.max(days / 365.25, 0.08);
  const annualStd = Math.sqrt(variance) * Math.sqrt(trades.length / years);
  const sharpe = annualStd > 0 ? (total / fund / years - rf) / annualStd : 0;
  const wins = trades.filter((t) => t.realized_pnl > 0);
  const losses = trades.filter((t) => t.realized_pnl < 0);
  const grossWin = wins.reduce((a, t) => a + t.realized_pnl, 0);
  const grossLoss = losses.reduce((a, t) => a + t.realized_pnl, 0);
  return { total, sharpe, wins: wins.length, losses: losses.length, count: trades.length, winRate: trades.length ? wins.length / trades.length : 0,
    grossWin, grossLoss, profitFactor: grossWin / Math.max(Math.abs(grossLoss), 1),
    unrealized: trades.reduce((a, t) => a + t.unrealized_pnl, 0), open: trades.filter((t) => !t.is_closed).length };
}
