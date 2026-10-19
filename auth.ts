import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import sql from '@/lib/db';
import { authConfig } from './auth.config';

type DbUser = { id: string; name: string; email: string; password: string; role: string; email_verified_at: Date | null };

async function getUser(email: string): Promise<DbUser | undefined> {
  const rows = await sql<DbUser[]>`SELECT id, name, email, password, role, email_verified_at FROM users WHERE lower(email) = ${email.trim().toLowerCase()}`;
  return rows[0];
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = z.object({ email: z.string().email(), password: z.string().min(6) }).safeParse(credentials);
        if (!parsed.success) return null;
        const user = await getUser(parsed.data.email);
        if (!user) return null;
        if (!user.email_verified_at) return null; // invited but not accepted yet (P25): set a password from the email first
        const ok = await bcrypt.compare(parsed.data.password, user.password);
        return ok ? { id: user.id, name: user.name, email: user.email, role: user.role } : null;
      },
    }),
  ],
});
