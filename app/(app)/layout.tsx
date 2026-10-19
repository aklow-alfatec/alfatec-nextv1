import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { isSuperadmin } from '@/lib/access';
import { currentViewer } from '@/lib/viewer';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await currentViewer();     // role from the database: a removed account is signed out here
  if (!v) redirect('/login');
  return (
    <AppShell user={{ name: v.name, email: v.email }} access={{ guest: v.guest, guestMode: v.guestMode, superadmin: isSuperadmin(v.realRole) }}>
      {children}
    </AppShell>
  );
}
