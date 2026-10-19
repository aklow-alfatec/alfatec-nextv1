'use server';

import bcrypt from 'bcrypt';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { checkToken } from '@/lib/auth-tokens';
import sql from '@/lib/db';
import { passwordProblem } from '@/lib/passwords';

/** Choose a password from an invite or reset link (P25). Uses the token up, sets the password, marks the email
 *  verified (an invite proves the address), ends older sessions, and signs the person in. */
export async function setPasswordAction(token: string, password: string, confirm: string): Promise<string | undefined> {
  const t = await checkToken(token);
  if (!t) return 'This link has expired or was already used. Ask for a new one.';
  if (password !== confirm) return 'The passwords do not match.';
  const problem = passwordProblem(password, t.email);
  if (problem) return problem;
  const hash = await bcrypt.hash(password, 10);
  const ok = await sql.begin(async (tx) => {
    const used = await tx`UPDATE auth_tokens SET used_at = now() WHERE id = ${t.tokenId}::uuid AND used_at IS NULL AND expires_at > now() RETURNING id`;
    if (used.length !== 1) return false;   // used in another tab meanwhile
    // password_changed_at from the app's clock (sessions are stamped by this server, not the database)
    await tx`UPDATE users SET password = ${hash}, password_changed_at = ${new Date()}, email_verified_at = coalesce(email_verified_at, now())
             WHERE id = ${t.userId}::uuid`;
    return true;
  });
  if (!ok) return 'This link has expired or was already used. Ask for a new one.';
  try {
    await signIn('credentials', { email: t.email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return 'Your password is set. Sign in with it now.';
    throw e;   // the redirect after a successful sign-in
  }
}
