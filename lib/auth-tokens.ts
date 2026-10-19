import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import sql from './db';

/** Server-side only. One-time tokens for invites and password resets (table auth_tokens, migration M12).
 *  The raw token only ever exists in the email link; the table keeps its SHA-256 hash. A token is single use,
 *  expires, and a new token cancels the older unused ones of the same kind for that user. */

export type TokenKind = 'invite' | 'reset';
export const TTL_HOURS: Record<TokenKind, number> = { invite: 48, reset: 1 };

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function issueToken(userId: string, kind: TokenKind): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await sql.begin(async (tx) => {
    await tx`UPDATE auth_tokens SET used_at = now() WHERE user_id = ${userId}::uuid AND kind = ${kind} AND used_at IS NULL`;
    await tx`INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at)
             VALUES (${userId}::uuid, ${kind}, ${hash(raw)}, now() + make_interval(hours => ${TTL_HOURS[kind]}))`;
  });
  return raw;
}

export interface TokenUser { tokenId: string; kind: TokenKind; userId: string; email: string; name: string; role: string | null }

/** The token's user when it is valid (exists, unused, not expired), else null. Does not use it up. */
export async function checkToken(raw: string): Promise<TokenUser | null> {
  if (!raw || raw.length < 20 || raw.length > 100) return null;
  const h = hash(raw);
  const [r] = await sql<{ id: string; kind: TokenKind; token_hash: string; user_id: string; email: string; name: string; role: string | null }[]>`
    SELECT t.id::text, t.kind, t.token_hash, t.user_id::text, u.email, u.name, u.role
    FROM auth_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${h} AND t.used_at IS NULL AND t.expires_at > now()`;
  if (!r || !timingSafeEqual(Buffer.from(r.token_hash), Buffer.from(h))) return null;
  return { tokenId: r.id, kind: r.kind, userId: r.user_id, email: r.email, name: r.name, role: r.role };
}

/** Marks the token used; false when it was used or expired meanwhile (two tabs racing). */
export async function useToken(tokenId: string): Promise<boolean> {
  const rows = await sql`UPDATE auth_tokens SET used_at = now() WHERE id = ${tokenId}::uuid AND used_at IS NULL AND expires_at > now() RETURNING id`;
  return rows.length === 1;
}

/** How many tokens of a kind were issued to this user in the last hour (rate limit for invites and resets). */
export async function recentTokens(userId: string, kind: TokenKind): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM auth_tokens WHERE user_id = ${userId}::uuid AND kind = ${kind} AND created_at > now() - interval '1 hour'`;
  return r?.n ?? 0;
}
