'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';

export function LoginForm({ canReset, notice }: { canReset: boolean; notice?: string }) {
  const [error, action, pending] = useActionState(loginAction, undefined);
  return (
    <div className="w-full max-w-sm space-y-6">
    <div className="flex justify-center"><Logo size={40} /></div>
    <Card title="Sign in">
      <form action={action} className="space-y-3">
        {notice && <p className="rounded bg-positive/10 p-2 text-xs text-positive">{notice}</p>}
        <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
        <Input name="password" type="password" placeholder="Password" required minLength={6} autoComplete="current-password" />
        {error && <p className="text-xs text-negative">{error}</p>}
        <Button variant="primary" type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
        {canReset && (
          <div className="text-right text-xs"><Link href="/forgot-password" className="text-fg-2 hover:text-fg hover:underline">Forgot password?</Link></div>
        )}
      </form>
    </Card>
    </div>
  );
}
