import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  if ((await auth())?.user) redirect('/');
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <LoginForm />
    </div>
  );
}
