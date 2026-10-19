'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { setGuestModeAction } from '@/app/actions';
import type { GuestRow } from '@/lib/guests';
import { emailGuestAction, inviteGuestAction, removeGuestAction } from './actions';

/** Superadmin: guest accounts (P24, P25). Guests are invited by email and choose their own password from the link
 *  (which verifies the email); passwords are never shown here. Also the guest-mode preview. */
export function GuestsCard({ guests, mailOk }: { guests: GuestRow[]; mailOk: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      setError('');
      setNote('');
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? 'failed');
        return;
      }
      if (r.message) setNote(r.message);
      router.refresh();
    });

  return (
    <Card title={`Guest accounts (${guests.length})`}>
      <p className="mb-3 text-xs text-fg-3">
        Guests see Overview, Grades and symbol pages only: no Studio, Admin or Data, and grade components shown as Indicator 1, 2, ...
        An invite email lets the guest choose a password; the link works once and expires in 48 hours. Superadmins only.
      </p>
      {!mailOk && (
        <p className="mb-3 rounded bg-warning/10 p-2 text-xs text-warning">
          Email is not set up (SMTP settings missing), so guests cannot be invited or sent reset links.
        </p>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name;
          const m = email;
          act(() => inviteGuestAction(n, m));
          setName('');
          setEmail('');
        }}
      >
        <label className="text-xs text-fg-2">
          Name
          <Input className="mt-1 w-44" value={name} onChange={(e) => setName(e.target.value)} required disabled={!mailOk} />
        </label>
        <label className="text-xs text-fg-2">
          Email
          <Input className="mt-1 w-60" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!mailOk} />
        </label>
        <Button type="submit" variant="primary" disabled={pending || !mailOk}>{pending ? 'Sending...' : 'Send invite'}</Button>
      </form>
      {error && <p className="mt-2 rounded bg-negative/10 p-2 text-xs text-negative">{error}</p>}
      {note && <p className="mt-2 rounded bg-positive/10 p-2 text-xs text-positive">{note}</p>}
      {guests.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-fg-3">
            <tr>
              <th className="py-1 text-left font-medium">Name</th>
              <th className="py-1 text-left font-medium">Email</th>
              <th className="py-1 text-left font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} className="border-t border-line">
                <td className="py-1.5">{g.name}</td>
                <td className="py-1.5 text-fg-2">{g.email}</td>
                <td className="py-1.5 text-xs">{g.verified ? <span className="text-positive">active</span> : <span className="text-warning">invited · not yet accepted</span>}</td>
                <td className="py-1.5 text-right">
                  <span className="inline-flex gap-2">
                    <Button size="sm" disabled={pending || !mailOk} onClick={() => act(() => emailGuestAction(g.email))}>
                      {g.verified ? 'Send reset link' : 'Resend invite'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        const typed = window.prompt(`Remove the guest account ${g.email}? Type the email to confirm.`);
                        if (typed?.trim().toLowerCase() === g.email.toLowerCase()) act(() => removeGuestAction(g.email));
                      }}
                    >
                      Remove
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-fg-2">Preview the app as a guest</span>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setGuestModeAction(true);
              router.push('/');
              router.refresh();
            })
          }
        >
          View as guest
        </Button>
      </div>
    </Card>
  );
}
