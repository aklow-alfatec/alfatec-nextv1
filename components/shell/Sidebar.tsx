'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV } from '@/lib/nav';
import { signOutAction } from '@/app/actions';

export function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

export function Sidebar({
  user,
  open,
  onClose,
}: {
  user: { name?: string | null; email?: string | null };
  open: boolean;
  onClose: () => void;
}) {
  const path = usePathname();
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
          <span className="grid h-6 w-6 place-items-center rounded-chip bg-accent text-xs font-bold text-accent-fg">A</span>
          <span className="font-semibold tracking-tight">Alfatec</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {NAV.map((g, i) => (
            <div key={i} className="mt-4 first:mt-0">
              {g.title && (
                <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-fg-3">{g.title}</div>
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
