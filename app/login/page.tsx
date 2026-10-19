import { redirect } from 'next/navigation';
import { sessionUser } from '@/lib/session-user';
import { mailConfigured } from '@/lib/mailer';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const { changed } = await searchParams;
  if (await sessionUser()) redirect('/');
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <LoginForm canReset={mailConfigured()} notice={changed ? 'Password changed. Sign in with your new password.' : undefined} />
    </div>
  );
}
