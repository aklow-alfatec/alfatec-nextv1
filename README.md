# alfatec-nextv1

Alfatec front-end v1: design system, app shell, login, engine proxy, and the Studio graph editor.
Next.js 15 (App Router), React 19, Tailwind 3, Auth.js v5 (next-auth beta).

## Setup

```bash
npm install
```

Create `.env.local` (git-ignored) with the variable NAMES listed in `.env.example`.
For local dev take the values from `../alfatec-nextv0/.env.local` (`AUTH_SECRET`, `AUTH_TRUST_HOST`,
`POSTGRES_URL`); do not copy that file into this repo or commit any values.

| Variable | Purpose |
|---|---|
| `AUTH_SECRET`, `AUTH_TRUST_HOST` | Auth.js session signing (use the same secret as nextv0 only if you want shared sessions) |
| `POSTGRES_URL` | Read-only lookup in the existing nextv0 `users` table (bcrypt check, same as nextv0) |
| `ENGINE_API_URL` | Origin of the engine API, e.g. `http://localhost:8000` (the proxy appends `/api/v1/...`) |
| `ENGINE_API_SECRET` | Sent as `X-Engine-Secret` by the proxy. Server-side only, never `NEXT_PUBLIC_` |

## Run

```bash
# backend (separate terminal)
cd ../alfatec-backend && venv/Scripts/python -m uvicorn api.index:app --port 8000

# front-end
npm run dev          # http://localhost:3000
npm run build && npm start
npx tsc --noEmit
```

## Layout

- `app/(app)/*` protected routes inside the shell (layout checks the session; `middleware.ts` also redirects).
- `app/login` Credentials login; `auth.ts` (bcrypt + `users` table), `auth.config.ts` (edge-safe).
- `app/api/engine/[...path]` authenticated proxy: `/api/engine/x` -> `${ENGINE_API_URL}/api/v1/x`.
  Returns 401 without a session. The browser never sees the engine URL or secret.
- `components/ui` design-system components, `components/shell` sidebar/top bar. `/ui` is the gallery.
- `features/studio` plain React graph editor (no Next imports); mounted with `next/dynamic` at
  `/studio/graphs/[id]` (`new` for a blank graph) and listed at `/studio/graphs`. It only talks to `/api/engine`.
- Tokens live in `app/globals.css` (dark default; light with `data-theme="light"`), mapped in `tailwind.config.ts`.

## Notes

- The database is only ever read (`SELECT` on `users`). Nothing here writes to Supabase.
- The current backend does not check `X-Engine-Secret` yet; the header is sent for when it does.
