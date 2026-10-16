import { auth } from '@/auth';

/** The signed-in user (server side). Admin pages and admin actions require role admin or superadmin. */
export async function sessionUser(): Promise<{ id: string; name: string | null; email: string | null; role: string | null } | null> {
  const s = await auth();
  const u = s?.user as { id?: string; name?: string | null; email?: string | null; role?: string } | undefined;
  return u?.id ? { id: u.id, name: u.name ?? null, email: u.email ?? null, role: u.role ?? null } : null;
}

export const isAdminRole = (role: string | null | undefined) => role === 'admin' || role === 'superadmin';

export async function requireAdmin() {
  const u = await sessionUser();
  if (!u) throw new Error('Not signed in');
  if (!isAdminRole(u.role)) throw new Error('Admins only');
  return u;
}
