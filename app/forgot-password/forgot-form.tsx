'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { requestResetAction } from './actions';

export function ForgotForm() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex justify-center"><Logo size={40} /></div>
      <Card title="Reset your password">
        {sent ? (
          <p className="text-sm text-fg-2">{sent}</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => setSent(await requestResetAction(email)));
            }}
          >
            <p className="text-sm text-fg-2">Enter your email and we will send you a link to choose a new password.</p>
            <Input name="email" type="email" placeholder="Email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button variant="primary" type="submit" className="w-full" disabled={pending}>{pending ? 'Sending...' : 'Send reset link'}</Button>
          </form>
        )}
        <div className="mt-3 text-sm"><Link href="/login" className="text-fg-2 hover:underline">Back to sign in</Link></div>
      </Card>
    </div>
  );
}
