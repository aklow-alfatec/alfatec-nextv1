'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Button, StatusPill } from '@/components/ui';
import { ALL_NAV } from '@/lib/nav';

function ThemeToggle() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => setTheme(document.documentElement.dataset.theme || 'dark'), []);
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Toggle theme"
      onClick={() => {
        const n = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = n;
        try {
          localStorage.setItem('theme', n);
        } catch {
          /* storage unavailable */
        }
        setTheme(n);
      }}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}

function Search() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => ref.current?.focus(), 0);
    }
  }, [open]);
  const hits = ALL_NAV.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  const go = (href: string) => {
    router.push(href);
    setOpen(false);
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center justify-between rounded-control border border-line-2 bg-bg px-3 text-sm text-fg-3"
      >
        <span>Search</span>
        <kbd className="num hidden rounded-chip border border-line-2 px-1 text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-card border border-line-2 bg-surface p-2" onClick={(e) => e.stopPropagation()}>
            <input
              ref={ref}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Go to..."
              onKeyDown={(e) => e.key === 'Enter' && hits[0] && go(hits[0].href)}
              className="h-9 w-full rounded-control bg-bg px-3 text-sm outline-none"
            />
            <ul className="mt-2 max-h-64 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.href}>
                  <button className="w-full rounded-control px-3 py-2 text-left text-sm hover:bg-raised" onClick={() => go(h.href)}>
                    {h.label}
                  </button>
                </li>
              ))}
              {hits.length === 0 && <li className="px-3 py-2 text-sm text-fg-3">No matches</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
          <Button variant="ghost" size="sm" className="md:hidden" aria-label="Menu" onClick={() => setOpen(true)}>
            Menu
          </Button>
          <Search />
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <StatusPill status="idle" label="Prices" detail="n/a" />
            <StatusPill status="idle" label="COT" detail="n/a" />
            <StatusPill status="idle" label="Macro" detail="n/a" />
          </div>
          <ThemeToggle />
          <Button variant="primary" size="sm" onClick={() => router.push('/studio/graphs')}>
            New graph
          </Button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
