import { cookies } from 'next/headers';
import { GUEST_MODE_COOKIE, effectiveRole, isGuestView, isSuperadmin } from '@/lib/access';
import { sessionUser } from '@/lib/session-user';

/** The signed-in user with the role access is decided on (server side). `realRole` is the account's own role;
 *  `role` is `guest` while a superadmin previews guest mode. */
export async function currentViewer() {
  const user = await sessionUser();
  if (!user) return null;
  const jar = await cookies();
  const role = effectiveRole(user.role, jar.get(GUEST_MODE_COOKIE)?.value);
  return {
    ...user,
    realRole: user.role,
    role,
    guest: isGuestView(role),
    guestMode: isSuperadmin(user.role) && role === 'guest',
  };
}

export type Viewer = NonNullable<Awaited<ReturnType<typeof currentViewer>>>;
