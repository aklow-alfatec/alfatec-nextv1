'use server';

import { revalidatePath } from 'next/cache';
import { removeUser, setUserRole } from '@/lib/assets';
import { ROLES as ROLE_LIST, isSuperadmin } from '@/lib/access';
import { createGuest, removeGuest, resetGuestPassword } from '@/lib/guests';
import { isAdminRole, requireAdmin, sessionUser } from '@/lib/session-user';

const ROLES: string[] = [...ROLE_LIST];

export async function setRoleAction(email: string, role: string) {
  try {
    const me = await requireAdmin();
    if (!ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(', ')}`);
    if (email === me.email && !isAdminRole(role)) throw new Error('You cannot remove your own admin role');
    await setUserRole(email, role);
    revalidatePath('/settings');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function removeUserAction(email: string) {
  try {
    const me = await requireAdmin();
    if (email === me.email) throw new Error('You cannot delete your own account');
    await removeUser(email);
    revalidatePath('/settings');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------- guest accounts (superadmin only)

async function requireSuperadmin() {
  const u = await sessionUser();          // the account's current role from the database
  if (!u) throw new Error('Not signed in');
  if (!isSuperadmin(u.role)) throw new Error('Superadmins only');
  return u;
}

type GuestResult = { ok: true; password?: string } | { ok: false; error: string };

async function guestRun(fn: () => Promise<string | void>): Promise<GuestResult> {
  try {
    await requireSuperadmin();
    const password = await fn();
    revalidatePath('/settings');
    return { ok: true, ...(password ? { password } : {}) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Creates a guest; returns its one-time password (shown once to the superadmin). */
export async function addGuestAction(name: string, email: string) {
  return guestRun(() => createGuest(name, email));
}
export async function resetGuestAction(email: string) {
  return guestRun(() => resetGuestPassword(email));
}
export async function removeGuestAction(email: string) {
  return guestRun(() => removeGuest(email));
}
