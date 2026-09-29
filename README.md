# DSA ERP

Internal ERP for Dynamic Space Architects. This repository is the Next.js app for the existing Supabase project. The database schema is already live; this app does not change it.

Public signups are disabled. Accounts are created by an admin.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- shadcn/ui
- Supabase Auth with `@supabase/supabase-js` and `@supabase/ssr`

## Local setup

Clone the repository, install dependencies, and copy the environment file:

```bash
git clone https://github.com/fasourav/dsa-erp.git
cd dsa-erp
npm install
cp .env.local.example .env.local
```

`.env.local.example` holds the project URL and the publishable key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Copy it to `.env.local` before starting the app. `.env.local` is gitignored. Do not commit it.

Never put the Supabase `service_role` key in client code or in any `NEXT_PUBLIC_*` variable.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The Supabase Auth Site URL for this project is `http://localhost:3000`.

Unauthenticated visits are sent to `/login`. After a successful email and password sign-in, the app opens `/dashboard`, which shows the signed-in email. Sign out from the header.

## Route protection

Next.js 16 checks the session in `src/proxy.ts` (the renamed middleware file). The proxy refreshes the Supabase auth cookie and redirects:

- signed-out users to `/login`
- signed-in users who open `/login` to `/dashboard`
