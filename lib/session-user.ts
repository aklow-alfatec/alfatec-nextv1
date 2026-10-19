import { cache } from 'react';
import { auth } from '@/auth';
import sql from '@/lib/db';

/** The signed-in user (server side), with the role read from the users table on each request (once per request),
 *  so a role change or a removed account takes effect at once rather than at the next login. Null when signed out
 *  or when the account no longer exists. Admin pages and admin actions require role admin or superadmin. */
export const sessionUser = cache(async (): Promise<{ id: string; name: string | null; email: string | null; role: string | null } | null> => {
  const s = await auth();
  const u = s?.user as { id?: string; name?: string | null; email?: string | null; role?: string } | undefined;
  if (!u?.id) return null;
  const [row] = await sql<{ name: string | null; email: string; role: string | null }[]>`
    SELECT name, email, role FROM users WHERE id::text = ${u.id}`;
  if (!row) return null;
  return { id: u.id, name: row.name ?? u.name ?? null, email: row.email ?? u.email ?? null, role: row.role ?? null };
});

export const isAdminRole = (role: string | null | undefined) => role === 'admin' || role === 'superadmin';

export async function requireAdmin() {
  const u = await sessionUser();
  if (!u) throw new Error('Not signed in');
  if (!isAdminRole(u.role)) throw new Error('Admins only');
  return u;
}
