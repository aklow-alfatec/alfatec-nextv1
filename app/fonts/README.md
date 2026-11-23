Self-hosted fonts (latin subset), loaded with next/font/local in app/layout.tsx. Taken from the @fontsource npm
packages 5.3.0 (IBM Plex Sans, IBM Plex Mono, Plus Jakarta Sans), licensed under the SIL Open Font License 1.1.

Self-hosted since 2026-11-23: next/font/google under Turbopack (Next 15.5.7) failed with "next/font/google queries
have exactly one entry" once Google's font URLs gained a second query parameter; local files need no download at
build time.
