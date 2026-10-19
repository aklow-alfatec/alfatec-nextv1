import { redirect } from 'next/navigation';
import { currentViewer } from '@/lib/viewer';

// Studio is not part of the guest view (lib/access.ts); the middleware redirects first, this re-checks the
// account's current role from the database.
export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const v = await currentViewer();
  if (!v) redirect('/login');
  if (v.guest) redirect('/');
  return <>{children}</>;
}
