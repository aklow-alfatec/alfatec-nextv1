import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import sql from './db';

/** Server-side only. Guest accounts (role `guest`), managed by superadmins in Settings. Every query is limited to
 *  rows whose role is guest, so these functions can never change or delete another account. */

export interface GuestRow { id: string; name: string; email: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 16 characters from an unambiguous alphabet (no 0/O, 1/l/I), from a cryptographic random source. */
export function newPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(32);
  let out = '';
  for (let i = 0; out.length < 16 && i < bytes.length; i++) if (bytes[i] < 224) out += alphabet[bytes[i] % alphabet.length];
  return out.length === 16 ? out : newPassword();
}

export async function listGuests(): Promise<GuestRow[]> {
  return sql<GuestRow[]>`SELECT id::text, name, email FROM users WHERE role = 'guest' ORDER BY name ASC`;
}

/** Creates a guest and returns its one-time password (stored only as a bcrypt hash, like every login). */
export async function createGuest(name: string, email: string): Promise<string> {
  const n = name.trim();
  const e = email.trim().toLowerCase();
  if (!n) throw new Error('Enter a name');
  if (!EMAIL.test(e)) throw new Error('Enter a valid email');
  const [taken] = await sql`SELECT 1 FROM users WHERE lower(email) = ${e}`;
  if (taken) throw new Error('An account with this email already exists');
  const password = newPassword();
  const hash = await bcrypt.hash(password, 10);
  await sql`INSERT INTO users (name, email, password, role) VALUES (${n}, ${e}, ${hash}, 'guest')`;
  return password;
}

/** New one-time password for a guest; refuses any account that is not a guest. */
export async function resetGuestPassword(email: string): Promise<string> {
  const password = newPassword();
  const hash = await bcrypt.hash(password, 10);
  const rows = await sql`UPDATE users SET password = ${hash} WHERE email = ${email} AND role = 'guest' RETURNING id`;
  if (rows.length !== 1) throw new Error('Not a guest account');
  return password;
}

/** Deletes a guest account; refuses any account that is not a guest. */
export async function removeGuest(email: string): Promise<void> {
  const rows = await sql`DELETE FROM users WHERE email = ${email} AND role = 'guest' RETURNING id`;
  if (rows.length !== 1) throw new Error('Not a guest account');
}
