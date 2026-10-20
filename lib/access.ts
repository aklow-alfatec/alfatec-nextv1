/**
 * Who sees what (P24). Pure functions, no database or Next imports, so the edge middleware (auth.config.ts) and
 * server code share them.
 *
 * - Full access (Studio, Trades, Data): viewer, user (nextv0's default), admin, superadmin.
 * - Everything else is the guest view, deny by default: role `guest`, an empty role or an unknown one.
 * - A superadmin can preview the guest view: the GUEST_MODE_COOKIE is honoured for superadmins only.
 */

export const FULL_ROLES = ['viewer', 'user', 'admin', 'superadmin'] as const;
export const ROLES = ['guest', 'viewer', 'admin', 'superadmin'] as const;   // roles an admin can assign
export const GUEST_MODE_COOKIE = 'alfatec_view_as';
export const GUEST_MODE_VALUE = 'guest';

export const isSuperadmin = (role: string | null | undefined) => role === 'superadmin';

/** The role access is decided on: `guest` while a superadmin has guest mode on, else the real role. */
export function effectiveRole(realRole: string | null | undefined, guestModeCookie: string | null | undefined): string | null {
  if (isSuperadmin(realRole) && guestModeCookie === GUEST_MODE_VALUE) return 'guest';
  return realRole ?? null;
}

/** True for the guest view (role guest, empty or unknown). */
export const isGuestView = (role: string | null | undefined) => !(FULL_ROLES as readonly string[]).includes(role ?? '');
export const canUseStudio = (role: string | null | undefined) => !isGuestView(role);

/** Paths the guest view may not open: Studio, Data, a new trade and the engine / studio data APIs. The Overview
 *  section (Grades, Assets, Trades, Backtest) is open to guests read-only; asset pages are masked. */
const BLOCKED = [/^\/studio(\/|$)/, /^\/trades\/new\/?$/, /^\/data(\/|$)/, /^\/api\/engine(\/|$)/, /^\/api\/studio-db(\/|$)/];
export const blockedForGuest = (path: string) => BLOCKED.some((re) => re.test(path));

/** Component names hidden from guests: "Indicator 1", "Indicator 2", ... in the pipeline's order. */
export const maskedName = (index: number) => `Indicator ${index + 1}`;

export interface PartLike { node: string; input?: string | null; value?: number | null; score?: number | null; rule?: string }

/** A guest's copy of grade components: names replaced by Indicator n, inputs, values and rules removed. */
export function maskParts<T extends PartLike>(parts: T[]): (Omit<T, 'node' | 'input' | 'value' | 'rule'> & PartLike)[] {
  return parts.map((p, i) => ({ ...p, node: maskedName(i), input: null, value: null, rule: '' }));
}
