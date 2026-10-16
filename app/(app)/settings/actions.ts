'use server';

import { revalidatePath } from 'next/cache';
import { removeUser, setUserRole } from '@/lib/assets';
import { requireAdmin } from '@/lib/session-user';

const ROLES = ['viewer', 'admin', 'superadmin'];

export async function setRoleAction(email: string, role: string) {
  try {
    const me = await requireAdmin();
    if (!ROLES.includes(role)) throw new Error(`Role must be one of ${ROLES.join(', ')}`);
    if (email === me.email && role === 'viewer') throw new Error('You cannot remove your own admin role');
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
