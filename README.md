# معارفك (Maarefak)

Arabic-first RTL social web app / PWA.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS + shadcn-style components
- Supabase Auth + Postgres + Realtime + Storage + RLS
- Vercel hosting

## Core v1
- +18 registration and profile completion
- Country -> city dependent dropdowns
- Selectable interest tags
- Random Chat matching
- Connection requests and private realtime chat
- User-created group chat spaces
- 24-hour space pin using Stars
- Stars wallet and transaction ledger (no fake purchases)
- Profile visitors, interest, block/unblock and reports
- Notifications, privacy settings and in-app account deletion

## Supabase
The connected project is already provisioned. `supabase/migrations/001_initial_schema.sql` reproduces the database schema on a fresh project.

## Environment
Copy `.env.example` to `.env.local` if you want to override the built-in public Supabase project configuration. Never put a service-role key in browser code. 
Deployment trigger for Vercel.
