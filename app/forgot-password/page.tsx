import { redirect } from 'next/navigation';
import { mailConfigured } from '@/lib/mailer';
import { ForgotForm } from './forgot-form';

export const dynamic = 'force-dynamic';

/** Public: ask for a password reset link. Without email set up there is no reset, so it goes back to sign in. */
export default function ForgotPasswordPage() {
  if (!mailConfigured()) redirect('/login');
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <ForgotForm />
    </div>
  );
}
