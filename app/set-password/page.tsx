import Link from 'next/link';
import { Card } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { checkToken } from '@/lib/auth-tokens';
import { SetPasswordForm } from './set-password-form';

export const dynamic = 'force-dynamic';

/** Public: the page an invite or reset email links to (?token=...). */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const t = await checkToken(token);
  return (
    <div className="grid min-h-screen place-items-center p-4">
      {t ? (
        <SetPasswordForm token={token} email={t.email} invite={t.kind === 'invite'} />
      ) : (
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-center"><Logo size={40} /></div>
          <Card title="This link has expired">
            <p className="text-sm text-fg-2">
              The link was already used, replaced by a newer one, or is older than its time limit. Ask for a new reset link,
              or, for an invite, ask the person who invited you to resend it.
            </p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link href="/forgot-password" className="text-accent hover:underline">Reset my password</Link>
              <Link href="/login" className="text-fg-2 hover:underline">Sign in</Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
