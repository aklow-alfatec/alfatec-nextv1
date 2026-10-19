'use server';

import { appUrl, setPasswordLink } from '@/lib/app-url';
import { issueToken, recentTokens } from '@/lib/auth-tokens';
import sql from '@/lib/db';
import { mailConfigured, resetEmail } from '@/lib/mailer';

const NEUTRAL = 'If that email has an account, a link to choose a new password is on its way. It expires in 1 hour.';
const MAX_PER_HOUR = 3;

/** Always the same reply, so the form never tells whether an email has an account. A link is sent only to a
 *  verified account, at most 3 an hour. */
export async function requestResetAction(email: string): Promise<string> {
  const e = (email ?? '').trim().toLowerCase();
  if (!mailConfigured() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NEUTRAL;
  try {
    const [u] = await sql<{ id: string; email: string }[]>`
      SELECT id::text, email FROM users WHERE lower(email) = ${e} AND email_verified_at IS NOT NULL`;
    if (u && (await recentTokens(u.id, 'reset')) < MAX_PER_HOUR) {
      const token = await issueToken(u.id, 'reset');
      await resetEmail(u.email, setPasswordLink(await appUrl())(token));
    }
  } catch (err) {
    console.error('password reset request failed', (err as Error).message);
  }
  return NEUTRAL;
}
