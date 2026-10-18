'use client';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, undefined);
  return (
    <div className="w-full max-w-sm space-y-6">
    <div className="flex justify-center"><Logo size={40} /></div>
    <Card title="Sign in">
      <form action={action} className="space-y-3">
        <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <Input name="password" type="password" placeholder="Password" required minLength={6} autoComplete="current-password" />
        {error && <p className="text-xs text-negative">{error}</p>}
        <Button variant="primary" type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </Card>
    </div>
  );
}
