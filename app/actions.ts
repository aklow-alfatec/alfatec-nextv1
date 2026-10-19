'use server';
import { AuthError } from 'next-auth';
import { cookies } from 'next/headers';
import { signIn, signOut } from '@/auth';
import { GUEST_MODE_COOKIE, GUEST_MODE_VALUE, isSuperadmin } from '@/lib/access';
import { sessionUser } from '@/lib/session-user';

export async function signOutAction() {
  (await cookies()).delete(GUEST_MODE_COOKIE);
  await signOut({ redirectTo: '/login' });
}

/** Superadmin preview of the guest view (lib/access.ts). Turning it on needs the account's current role to be
 *  superadmin; turning it off is always allowed, so nobody can be stuck in it. */
export async function setGuestModeAction(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const jar = await cookies();
  if (!on) {
    jar.delete(GUEST_MODE_COOKIE);
    return { ok: true };
  }
  const u = await sessionUser();
  if (!u || !isSuperadmin(u.role)) return { ok: false, error: 'Superadmins only' };
  jar.set(GUEST_MODE_COOKIE, GUEST_MODE_VALUE, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' });
  return { ok: true };
}

/** Returns an error message, or never returns (redirects) on success. */
export async function loginAction(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
    });
  } catch (e) {
    if (e instanceof AuthError) return 'Invalid email or password.';
    throw e;
  }
}
