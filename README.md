# Pig Farm Ledger — Floot source export

This folder is a local snapshot of the **Pig Farm Ledger** project from Floot. It is stored next to your existing `PigLedger` Next.js/Supabase app so the two codebases stay separate.

## Important

This export preserves the Floot project's source files, including its pages, reusable components, authentication endpoints, ledger endpoints, database helpers, and styles. **It is not a standalone Next.js project.** Floot supplies the app shell/routing, runtime configuration, dependency setup, authentication/session service, and database environment used by these files.

Do not copy these files over your existing `WEB CODE\PigLedger` files as a bulk replacement. They use different app architectures and could break the current app. Use this folder as the Floot source snapshot or migrate features deliberately.

## Main features in the source

- Dashboard and financial summary
- Expense and sales ledgers
- Fattening-cycle calculator
- Farm settings
- JSON backup and restore
- Per-user ledger API access
- Local cache and offline synchronization queue
- Sign-in, registration, sessions, and password reset
- Responsive styling and reusable UI components

## Folder map

- `pages/` — dashboard and login pages
- `components/` — page components and shared UI components
- `helpers/` — database, auth/session, farm creation, and sync helpers
- `endpoints/` — authenticated ledger and auth APIs
- `base.css` — design tokens and global styles
- `database/ledger.sql` — reference schema for the three app ledger tables

## Dependencies and environment

The Floot project uses the Floot runtime plus packages such as React, React Router, React Query, Lucide, React Helmet, Zod, SuperJSON, Kysely, `kysely-postgres-js`, `postgres`, `jose`, and `bcryptjs`. The exact resolved list is maintained by the Floot project settings, not by this snapshot.

The database helper expects `FLOOT_DATABASE_URL`; authentication uses Floot's existing session/auth implementation and server-side secrets. Those secrets are **not** included here. Never copy real `.env.local` values into this export or commit private credentials.

## Database notes

The Floot project already has its own database. `database/ledger.sql` is a reference for setting up the ledger tables in a separate compatible database. Review it before running it; it does not provision Floot's auth tables or replace the existing authentication setup.

## Before production use

Run the typecheck and end-to-end checks in the actual Floot project. Test registration, login, creating/deleting expenses and sales, refresh persistence, offline queue sync, backup restoration, and isolation between accounts. A source export alone does not prove those workflows work in a new runtime.
