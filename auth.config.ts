import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';

// Edge-safe part of the Auth.js config (no bcrypt / database imports).
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const p = nextUrl.pathname;
      if (p === '/login') return loggedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      // logged out: '/' shows the public landing page (app/welcome) without changing the address
      if (p === '/' && !loggedIn) return NextResponse.rewrite(new URL('/welcome', nextUrl));
      if (p === '/welcome') return loggedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      return loggedIn; // everything else (pages and /api/engine) needs a session
    },
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.uid) {
        (session.user as { id?: string; role?: string }).id = token.uid as string;
        (session.user as { id?: string; role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
