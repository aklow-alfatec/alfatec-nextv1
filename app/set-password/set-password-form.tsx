'use client';

import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { MIN_LENGTH } from '@/lib/passwords';
import { setPasswordAction } from './actions';

export function SetPasswordForm({ token, email, invite }: { token: string; email: string; invite: boolean }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex justify-center"><Logo size={40} /></div>
      <Card title={invite ? 'Welcome: set your password' : 'Choose a new password'}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            start(async () => {
              const msg = await setPasswordAction(token, password, confirm);
              if (msg) setError(msg);
            });
          }}
        >
          <p className="text-sm text-fg-2">For <b>{email}</b></p>
          <label className="block text-xs text-fg-2">
            New password <span className="text-fg-3">(at least {MIN_LENGTH} characters)</span>
            <Input className="mt-1 w-full" type="password" autoComplete="new-password" minLength={MIN_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="block text-xs text-fg-2">
            Confirm password
            <Input className="mt-1 w-full" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </label>
          {error && <p className="text-xs text-negative">{error}</p>}
          <Button variant="primary" type="submit" className="w-full" disabled={pending}>
            {pending ? 'Saving...' : invite ? 'Set password and sign in' : 'Save and sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
