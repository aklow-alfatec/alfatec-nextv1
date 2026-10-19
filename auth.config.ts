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
      // the login page decides itself (lib/session-user.ts): a token can outlive its session (password changed,
      // account removed), and bouncing it to '/' here would loop with the app's redirect back to /login
      if (p === '/login') return true;
      // logged out: '/' shows the public landing page (app/welcome) without changing the address
      if (p === '/' && !loggedIn) return NextResponse.rewrite(new URL('/welcome', nextUrl));
      if (p === '/welcome') return loggedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      // public: choose a password from an invite / reset link, ask for a reset link
      if (p === '/set-password' || p === '/forgot-password') return true;
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
        // signed-in time, set once (the token's own iat moves forward each time Auth.js re-issues it)
        token.sat = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.uid) {
        (session.user as { id?: string; role?: string }).id = token.uid as string;
        (session.user as { id?: string; role?: string }).role = token.role as string;
        // when this sign-in happened (seconds): sessions from before a password change are refused (lib/session-user.ts);
        // a token from before this field existed has none and is treated as old once a password was changed
        (session as { issuedAt?: number }).issuedAt = typeof token.sat === 'number' ? token.sat : undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
