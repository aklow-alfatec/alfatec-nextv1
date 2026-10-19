export type NavItem = { label: string; href: string };
/** `full`: only for accounts with full access; hidden in the guest view (lib/access.ts). */
export type NavGroup = { title?: string; items: NavItem[]; full?: boolean };

export const NAV: NavGroup[] = [
  {
    items: [
      { label: 'Overview', href: '/' },
      { label: 'Grades', href: '/grades' },
    ],
  },
  {
    title: 'Admin',
    full: true,
    items: [
      { label: 'Symbols', href: '/symbols' },
      { label: 'Trades', href: '/trades' },
    ],
  },
  {
    title: 'Studio',
    full: true,
    items: [
      { label: 'Graphs', href: '/studio/graphs' },
      { label: 'Runs', href: '/studio/runs' },
      { label: 'Experiments', href: '/studio/experiments' },
      { label: 'Edge Lab', href: '/studio/edge-lab' },
      { label: 'Kelly', href: '/studio/kelly' },
    ],
  },
  { title: 'Data', full: true, items: [{ label: 'Assets and pulls', href: '/data' }] },
  { items: [{ label: 'Settings', href: '/settings' }] },
];
export const ALL_NAV = NAV.flatMap((g) => g.items);

/** The menu for this viewer: the guest view drops the full-access groups. */
export const navFor = (guest: boolean) => (guest ? NAV.filter((g) => !g.full) : NAV);
