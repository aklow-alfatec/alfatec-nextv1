import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';
import { GUEST_MODE_COOKIE, blockedForGuest, effectiveRole, isGuestView } from './lib/access';

// Edge-safe part of the Auth.js config (no bcrypt / database imports).
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const loggedIn = !!auth?.user;
      const p = nextUrl.pathname;
      if (p === '/login') return loggedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      // logged out: '/' shows the public landing page (app/welcome) without changing the address
      if (p === '/' && !loggedIn) return NextResponse.rewrite(new URL('/welcome', nextUrl));
      if (p === '/welcome') return loggedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      if (!loggedIn) return false; // everything else (pages and /api/engine) needs a session
      // guest view (role guest / unknown, or a superadmin previewing guest mode): no Studio, Trades, Data or engine
      // APIs. First line only: the role here is the one in the login token; server code re-checks the database role.
      const role = effectiveRole((auth?.user as { role?: string } | undefined)?.role, request.cookies.get(GUEST_MODE_COOKIE)?.value);
      if (isGuestView(role) && blockedForGuest(p)) {
        return p.startsWith('/api/') ? Response.json({ detail: 'Not available on this account' }, { status: 403 }) : Response.redirect(new URL('/', nextUrl));
      }
      return true;
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
