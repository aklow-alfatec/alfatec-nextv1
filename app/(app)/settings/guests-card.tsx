'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { setGuestModeAction } from '@/app/actions';
import type { GuestRow } from '@/lib/guests';
import { addGuestAction, removeGuestAction, resetGuestAction } from './actions';

/** Superadmin: guest accounts (add / reset password / remove) and the guest-mode preview. A one-time password is
 *  shown once, right after it is made; only its bcrypt hash is stored. */
export function GuestsCard({ guests }: { guests: GuestRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const act = (fn: () => Promise<{ ok: boolean; error?: string; password?: string }>, forEmail: string) =>
    start(async () => {
      setError('');
      setShown(null);
      setCopied(false);
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? 'failed');
        return;
      }
      if (r.password) setShown({ email: forEmail, password: r.password });
      router.refresh();
    });

  return (
    <Card title={`Guest accounts (${guests.length})`}>
      <p className="mb-3 text-xs text-fg-3">
        Guests see Overview, Grades and symbol pages only: no Studio, Admin or Data, and grade components shown as Indicator 1, 2, ...
        Superadmins only.
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const forEmail = email.trim().toLowerCase();
          act(() => addGuestAction(name, email), forEmail);
          setName('');
          setEmail('');
        }}
      >
        <label className="text-xs text-fg-2">
          Name
          <Input className="mt-1 w-44" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-xs text-fg-2">
          Email
          <Input className="mt-1 w-60" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <Button type="submit" variant="primary" disabled={pending}>Add guest</Button>
      </form>
      {error && <p className="mt-2 rounded bg-negative/10 p-2 text-xs text-negative">{error}</p>}
      {shown && (
        <div className="mt-3 rounded-card border border-line-2 bg-raised p-3 text-sm">
          <div className="text-xs text-fg-2">
            One-time password for <b>{shown.email}</b>. It is shown only now; send it to the guest.
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="num rounded bg-bg px-2 py-1 text-base">{shown.password}</code>
            <Button size="sm" onClick={() => navigator.clipboard.writeText(shown.password).then(() => setCopied(true))}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShown(null)}>Done</Button>
          </div>
        </div>
      )}
      {guests.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead className="text-xs text-fg-3">
            <tr>
              <th className="py-1 text-left font-medium">Name</th>
              <th className="py-1 text-left font-medium">Email</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.id} className="border-t border-line">
                <td className="py-1.5">{g.name}</td>
                <td className="py-1.5 text-fg-2">{g.email}</td>
                <td className="py-1.5 text-right">
                  <span className="inline-flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => act(() => resetGuestAction(g.email), g.email)}>Reset password</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        const typed = window.prompt(`Remove the guest account ${g.email}? Type the email to confirm.`);
                        if (typed?.trim().toLowerCase() === g.email.toLowerCase()) act(() => removeGuestAction(g.email), g.email);
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
