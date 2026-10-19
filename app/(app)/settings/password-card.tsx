'use client';

import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { MIN_LENGTH } from '@/lib/passwords';
import { changePasswordAction } from './actions';

/** Change password (every account, guests too). Every session ends, this one included: sign in again after. */
export function PasswordCard() {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  return (
    <Card title="Change password">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          setDone('');
          start(async () => {
            const r = await changePasswordAction(current, next, confirm);
            if (!r.ok) return setError(r.error);
            setDone(r.message ?? 'Password changed.');
            window.location.assign('/login?changed=1');
          });
        }}
      >
        <label className="block text-xs text-fg-2">
          Current password
          <Input className="mt-1 w-full" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label className="block text-xs text-fg-2">
          New password <span className="text-fg-3">(at least {MIN_LENGTH} characters)</span>
          <Input className="mt-1 w-full" type="password" autoComplete="new-password" minLength={MIN_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} required />
        </label>
        <label className="block text-xs text-fg-2">
          Confirm new password
          <Input className="mt-1 w-full" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && <p className="rounded bg-negative/10 p-2 text-xs text-negative">{error}</p>}
        {done && <p className="rounded bg-positive/10 p-2 text-xs text-positive">{done}</p>}
        <Button type="submit" variant="primary" disabled={pending}>{pending ? 'Saving...' : 'Change password'}</Button>
      </form>
    </Card>
  );
}
