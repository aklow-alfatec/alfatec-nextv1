import { headers } from 'next/headers';

/** Origin for links in emails. APP_URL in production (required: the request's Host header can be forged, and a
 *  reset link must never point anywhere else); the current request's host only in local development. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') throw new Error('APP_URL is not set: email links cannot be built safely.');
  const host = (await headers()).get('host') ?? 'localhost:3000';
  return `http://${host}`;
}

export const setPasswordLink = (origin: string) => (token: string) => `${origin}/set-password?token=${encodeURIComponent(token)}`;
