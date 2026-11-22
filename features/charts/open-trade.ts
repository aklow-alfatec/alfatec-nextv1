/** Open-trade drawdown: how far the position that is open now has fallen from its entry (average cost), in %.
 *  0 while the trade is at or above its entry, negative while below, null when flat. Pure (node --test loads it).
 *
 *  From the strategy's position series and the price it trades, at the run's own bars (close-marked): a position
 *  that grows keeps its average cost (price weighted by the units added), one that shrinks keeps it, a flip of side
 *  or a return from flat starts again at the current price. Long: price / cost - 1; short: 1 - price / cost. */
export interface OpenTradeDd {
  /** per bar: <= 0 (percent), null when flat */
  v: (number | null)[];
  /** the most negative value: the "max open-trade drawdown" (percent), null when never in a position */
  max: number | null;
}

export function openTradeDrawdown(price: (number | null)[], pos: (number | null)[]): OpenTradeDd {
  const n = Math.min(price.length, pos.length);
  const v: (number | null)[] = new Array(n).fill(null);
  let cost = NaN;
  let prev = 0;
  let max: number | null = null;
  for (let i = 0; i < n; i++) {
    const p = price[i];
    const q = pos[i];
    if (p === null || p === undefined || !Number.isFinite(p) || q === null || q === undefined || !Number.isFinite(q) || q === 0) {
      if (q === 0) prev = 0;                      // flat: the next entry starts a new trade
      continue;
    }
    if (prev === 0 || Math.sign(q) !== Math.sign(prev)) cost = p;
    else if (Math.abs(q) > Math.abs(prev)) cost = (cost * Math.abs(prev) + p * (Math.abs(q) - Math.abs(prev))) / Math.abs(q);
    prev = q;
    const r = q > 0 ? p / cost - 1 : 1 - p / cost;
    const dd = Math.min(0, r) * 100;
    v[i] = dd;
    if (max === null || dd < max) max = dd;
  }
  return { v, max };
}
