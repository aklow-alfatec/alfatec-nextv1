export type NavItem = { label: string; href: string; full?: boolean; admin?: boolean };
/** `full`: only for accounts with full access; hidden in the guest view (lib/access.ts). On a group it hides the
 *  whole group, on an item just that item. `admin` (items): admin and superadmin only, never in guest mode. */
export type NavGroup = { title?: string; items: NavItem[]; full?: boolean };

export const NAV: NavGroup[] = [
  {
    title: 'REVA.I.S',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Grades', href: '/grades' },
      { label: 'Assets', href: '/symbols' },
      { label: 'Trades', href: '/trades' },
      { label: 'Alerts', href: '/alerts', full: true },
      { label: 'Backtest', href: '/backtest' },
    ],
  },
  {
    title: 'Studio',
    full: true,
    items: [
      { label: 'All assets', href: '/studio/assets', admin: true },
      { label: 'Graphs', href: '/studio/graphs' },
      { label: 'Runs', href: '/studio/runs' },
      { label: 'Experiments', href: '/studio/experiments' },
      { label: 'Edge Lab', href: '/studio/edge-lab' },
      { label: 'Kelly', href: '/studio/kelly' },
    ],
  },
  { title: 'Data', full: true, items: [{ label: 'Assets and pulls', href: '/data' }] },
  { title: 'Account', items: [{ label: 'Settings', href: '/settings' }] },
];
export const ALL_NAV = NAV.flatMap((g) => g.items);

/** The menu for this viewer: the guest view drops the full-access groups; admin items need `admin`. */
export const navFor = (guest: boolean, admin = false): NavGroup[] =>
  (guest ? NAV.filter((g) => !g.full).map((g) => ({ ...g, items: g.items.filter((i) => !i.full) })) : NAV)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.admin || (admin && !guest)) }));
