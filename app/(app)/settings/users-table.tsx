'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { UserRow } from '@/lib/assets';
import { removeUserAction, setRoleAction } from './actions';

const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';

export function UsersTable({ users, me }: { users: UserRow[]; me: string | null }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    setError('');
    const r = await p;
    if (!r.ok) setError(r.error ?? 'failed');
    else router.refresh();
  };
  return (
    <div>
      {error && <p className="mb-2 rounded bg-negative/10 p-2 text-xs text-negative">{error}</p>}
      <table className="w-full text-sm">
        <thead className="text-xs text-fg-3">
          <tr><th className="py-1 text-left font-medium">Name</th><th className="py-1 text-left font-medium">Email</th><th className="py-1 text-left font-medium">Role</th><th /></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-1">{u.name}</td>
              <td className="py-1 text-fg-2">{u.email}{u.email === me && <span className="ml-1 text-[10px] text-fg-3">(you)</span>}</td>
              <td className="py-1">
                <select className={cell} value={u.role ?? 'viewer'} onChange={(e) => run(setRoleAction(u.email, e.target.value))}>
                  {['viewer', 'admin', 'superadmin'].map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td className="py-1 text-right">
                {u.email !== me && (
                  <button className="text-xs text-negative hover:underline" onClick={() => window.confirm(`Delete ${u.email}? They will not be able to sign in.`) && run(removeUserAction(u.email))}>
                    delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
