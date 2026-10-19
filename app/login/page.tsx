import { redirect } from 'next/navigation';
import { sessionUser } from '@/lib/session-user';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  if (await sessionUser()) redirect('/');
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <LoginForm />
    </div>
  );
}
