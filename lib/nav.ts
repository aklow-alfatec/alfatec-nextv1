export type NavItem = { label: string; href: string };
export type NavGroup = { title?: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    items: [
      { label: 'Overview', href: '/' },
      { label: 'Grades', href: '/grades' },
      { label: 'Heatmap', href: '/heatmap' },
      { label: 'Symbols', href: '/symbols' },
      { label: 'Trades', href: '/trades' },
    ],
  },
  {
    title: 'Studio',
    items: [
      { label: 'Graphs', href: '/studio/graphs' },
      { label: 'Runs', href: '/studio/runs' },
      { label: 'Experiments', href: '/studio/experiments' },
      { label: 'Edge Lab', href: '/studio/edge-lab' },
      { label: 'Kelly', href: '/studio/kelly' },
    ],
  },
  { title: 'Data', items: [{ label: 'Assets and pulls', href: '/data' }] },
  { items: [{ label: 'Settings', href: '/settings' }] },
];
export const ALL_NAV = NAV.flatMap((g) => g.items);
