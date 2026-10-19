import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { issueToken, recentTokens } from './auth-tokens';
import sql from './db';
import { inviteEmail, mailConfigured, resetEmail } from './mailer';

/** Server-side only. Guest accounts (role `guest`), managed by superadmins in Settings (P24, P25).
 *  A guest is invited by email: the account starts unverified with no usable password, and the invite link lets the
 *  person choose one (which also verifies the email). Every query is limited to rows whose role is guest, so these
 *  functions can never change or delete another account. */

export interface GuestRow { id: string; name: string; email: string; verified: boolean }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS_PER_HOUR = 3;

export async function listGuests(): Promise<GuestRow[]> {
  return sql<GuestRow[]>`SELECT id::text, name, email, email_verified_at IS NOT NULL AS verified
    FROM users WHERE role = 'guest' ORDER BY name ASC`;
}

function needMail() {
  if (!mailConfigured()) throw new Error('Email is not set up: add the SMTP settings to send invites and resets.');
}

/** Creates an unverified guest and emails the invite link (`link(token)` builds the set-password URL). */
export async function inviteGuest(name: string, email: string, link: (token: string) => string): Promise<void> {
  needMail();
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n) throw new Error('Enter a name');
  if (!EMAIL.test(e)) throw new Error('Enter a valid email');
  const [taken] = await sql`SELECT 1 FROM users WHERE lower(email) = ${e}`;
  if (taken) throw new Error('An account with this email already exists');
  // no usable password until the invite is accepted: a hash of random bytes nobody knows
  const unusable = await bcrypt.hash(randomBytes(32).toString('base64url'), 10);
  const [u] = await sql<{ id: string }[]>`INSERT INTO users (name, email, password, role, email_verified_at)
    VALUES (${n}, ${e}, ${unusable}, 'guest', NULL) RETURNING id::text`;
  const token = await issueToken(u.id, 'invite');
  try {
    await inviteEmail(e, n, link(token));
  } catch (err) {
    await sql`DELETE FROM users WHERE id = ${u.id}::uuid AND role = 'guest' AND email_verified_at IS NULL`;
    throw new Error(`The invite email could not be sent, so the account was not created: ${(err as Error).message}`);
  }
}

async function guestByEmail(email: string) {
  const [g] = await sql<{ id: string; name: string; email: string; verified: boolean }[]>`
    SELECT id::text, name, email, email_verified_at IS NOT NULL AS verified FROM users WHERE email = ${email} AND role = 'guest'`;
  if (!g) throw new Error('Not a guest account');
  return g;
}

/** Pending guest: a new invite link (the old one stops working). Verified guest: a password reset link. */
export async function emailGuestLink(email: string, link: (token: string) => string): Promise<'invite' | 'reset'> {
  needMail();
  const g = await guestByEmail(email);
  const kind = g.verified ? 'reset' : 'invite';
  if ((await recentTokens(g.id, kind)) >= MAX_EMAILS_PER_HOUR) throw new Error('Too many emails to this address in the last hour; try again later.');
  const token = await issueToken(g.id, kind);
  if (kind === 'invite') await inviteEmail(g.email, g.name, link(token));
  else await resetEmail(g.email, link(token));
  return kind;
}

/** Deletes a guest account (its tokens go with it); refuses any account that is not a guest. */
export async function removeGuest(email: string): Promise<void> {
  const rows = await sql`DELETE FROM users WHERE email = ${email} AND role = 'guest' RETURNING id`;
  if (rows.length !== 1) throw new Error('Not a guest account');
}
