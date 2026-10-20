'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { navFor } from '@/lib/nav';
import { setGuestModeAction, signOutAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { ShellAccess } from './AppShell';
import { Logo } from '@/components/brand/Logo';

export function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export function Sidebar({
  user,
  access,
  open,
  onClose,
}: {
  user: { name?: string | null; email?: string | null };
  access: ShellAccess;
  open: boolean;
  onClose: () => void;
}) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggleGuest = () => start(async () => {
    await setGuestModeAction(!access.guestMode);
    router.push('/');
    router.refresh();
  });
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface transition-transform md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <Logo size={24} />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {navFor(access.guest).map((g, i) => (
            <div key={i} className="mt-4 first:mt-0">
              {g.title && (
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#EA7A12]">{g.title}</div>
              )}
              {g.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onClose}
                  className={cn(
                    'flex h-9 items-center rounded-control px-2 text-sm transition-colors',
                    isActive(path, it.href) ? 'bg-raised text-fg' : 'text-fg-2 hover:bg-raised hover:text-fg',
                  )}
                >
                  {isActive(path, it.href) && <i className="mr-2 h-4 w-0.5 rounded bg-accent" />}
                  {it.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="truncate text-sm">{user.name ?? 'User'}</div>
          <div className="truncate text-xs text-fg-3">{user.email}</div>
          {access.superadmin && (
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 text-xs text-fg-2">
              View as guest
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={access.guestMode} disabled={pending} onChange={toggleGuest} />
            </label>
          )}
          <form action={signOutAction} className="mt-2">
            <button type="submit" className="text-xs text-fg-3 hover:text-fg">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
