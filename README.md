# DSA ERP

Private internal ERP for **DynamicSpace Architects & Engineers**.

This repository is the web app (and installable PWA) that runs against the firm's existing Supabase project. It is not a public product, template, or open-source release. Access is invite-only; public sign-up is off.

**Live app:** https://dsa-erp.vercel.app  
**Owner:** Fardin Ahsan Sourav (custom build for the client firm)

---

## What it covers

Finance and operations for a design & engineering practice, including:

- Clients, leads, projects, budgets, and project profitability
- Documents (Set C): quotations, RFQs, work orders, POs, invoices, receipts, vouchers, letters, and related PDFs
- Bank accounts, reconciliation, AP/AR, expenses, VAT/tax, payroll, assets
- Reports (P&L, balance sheet, cash flow, aging, project profit/budget, tax) with PDF/Excel export
- Owner-controlled users & permissions (per-module View / Add / Edit / Delete)

Money rules and which form posts which cost live in `docs/MONEY-RECORDING.md`. Document print/PDF behaviour is documented in `docs/DOCUMENTS.md`.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui |
| Data / auth | Supabase (Postgres, Auth, RLS) |
| Hosting | Vercel (`sin1`) |
| Documents | Set C HTML/CSS + pdf-lib / Chromium PDF pipeline |
| PWA | Custom `public/sw.js` + offline page |

---

## Repository layout

```
src/app/           App Router routes (dashboard, modules, auth, API)
src/components/    UI and feature components (incl. shadcn ui/)
src/lib/           Domain helpers, documents/Set C, reports, Supabase clients
public/            Brand, document fonts/CSS, PWA assets, service worker
supabase/          SQL migrations (+ tests)
scripts/           Document parity / preview helpers
docs/              Operator notes (money recording, documents)
.github/workflows/ CI (lint, typecheck, production build)
```

Historical atrium HTML mockups are **not** on `main`. They remain on branch `archive/atrium-mockups` if needed for design reference.

---

## Requirements

- Node.js 20+ (npm)
- Access to the firm's Supabase project and Vercel project
- Secrets only via local `.env.local` or Vercel env — never commit them

---

## Local setup

```bash
git clone https://github.com/fasourav/dsa-erp.git
cd dsa-erp
npm install
cp .env.local.example .env.local
```

Fill `.env.local` (gitignored):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable (anon) key — safe for the browser with RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; invites and privileged admin paths. **Never** expose as `NEXT_PUBLIC_*` |
| `NEXT_PUBLIC_SITE_URL` | App origin (`http://localhost:3000` locally; production site URL in Vercel) |

```bash
npm run dev
```

Open http://localhost:3000. Unauthenticated users go to `/login`. In Supabase Auth, set Site URL / redirect URLs to match the environment you are testing (local or production).

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

---

## Database

Schema changes ship as additive files under `supabase/migrations/`. Apply them through the firm's normal Supabase workflow (CLI or dashboard). Do not rewrite or delete migrations that have already been applied in production.

This app expects the live schema; it is not a greenfield "reset the database" starter.

---

## Deploy

Production deploys from `main` on Vercel. Set the same env vars in the Vercel project (including `SUPABASE_SERVICE_ROLE_KEY` for invite flows). Cron entries live in `vercel.json`.

CI on pull requests and `main`: lint, TypeScript, and production build (`.github/workflows/ci.yml`). CI uses placeholder public env values and does not need production secrets.

---

## Access & security

- Accounts are created by an owner/admin (email invite). There is no public registration.
- Module access is enforced in the UI and with database RLS where configured.
- Keep `.env.local`, `*.bak`, and service-role keys off git and off shared chat.
- Do not cache authenticated financial HTML in the service worker.

---

## Working on the codebase

- Prefer small, reviewable PRs into `main`.
- Restyles should not change money posting, document numbering, or migrations unless that is the task.
- Set C letterhead: `public/brand/letterhead-300dpi.png` — do not recompress or rename without updating every reference.
- Admin Expense (reports) = Operational + Marketing + Salary.

For deeper operator notes see `AGENTS.md`.

---

## Status

Private client project. Not licensed for redistribution. Contact the maintainer for access to the GitHub repo, Supabase, or Vercel.