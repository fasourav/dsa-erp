# DSA ERP Performance Budgets & Measurements

Baseline: `main` after PR #113 (`257d9d2`), `package.json` version `1.0.0`.

## Deployment Topology

| Component | Region / Setting |
|---|---|
| Vercel Functions | `sin1` (`vercel.json`) |
| Supabase Database & Auth | `<owner: fill Supabase region>` |

## Performance Budgets

| Metric | Budget | Notes |
|---|---|---|
| Shell useful (FCP, good 4G) | `< 1.0 s` (`< 1000 ms`) | App shell + navigation frame |
| Dashboard useful (LCP, mobile) | `< 2.5 s` (ceiling `3.0 s`) | Streamed KPI & summary content |
| INP / TBT (lab proxy) | `< 200 ms` | Main-thread responsiveness |
| CLS | `< 0.1` | Zero layout jump across skeletons |
| TTFB (Vercel `sin1`) | `< 600 ms` | Auth + server render start |

## Measurement Harness

### Lighthouse CLI (`perf:lh`)

Run mobile + desktop simulated Lighthouse audits and write compact JSON summaries to `perf/<label>-{mobile,desktop}.json` (git-ignored):

```bash
# Public route
npm run perf:lh -- http://localhost:3000/login final-login

# Authenticated routes (pass session cookie via PERF_COOKIE against local or Vercel preview)
PERF_COOKIE="sb-...=..." npm run perf:lh -- http://localhost:3000/dashboard final-dashboard
PERF_COOKIE="sb-...=..." npm run perf:lh -- http://localhost:3000/accounts/invoices final-invoices
PERF_COOKIE="sb-...=..." npm run perf:lh -- http://localhost:3000/accounts/bank final-bank
PERF_COOKIE="sb-...=..." npm run perf:lh -- http://localhost:3000/accounts/expenses final-expenses
```

Optional environment variables:
- `PERF_COOKIE`: `Cookie` header forwarded to Lighthouse requests for authenticated routes (`/dashboard`, `/accounts/*`).
- `CHROME_PATH`: Explicit Chrome/Chromium binary path if auto-detection cannot locate Chrome.

### Field Web Vitals (`/api/vitals`)

`src/components/web-vitals.tsx` hooks Next.js `useReportWebVitals` for `LCP`, `INP`, `CLS`, `FCP`, and `TTFB`:
- Non-production: logs `[web-vitals]` payloads to the browser console.
- Production: sends `navigator.sendBeacon("/api/vitals", body)` (with `fetch(..., { keepalive: true })` fallback), which logs one structured JSON line per metric and returns `204 No Content`.

---

## First Load JS (Initial Client Entry Chunks)

Measured from `.next/build-manifest.json` (`rootMainFiles`) + each route's `page_client-reference-manifest.js` (`entryJSFiles`), summed across unique `.js` chunks:

| Route | Stage | Entry Chunks | Raw JS (kB) | Gzip JS (kB) | Delta vs Baseline (Gzip) |
|---|---|---:|---:|---:|---:|
| `/login` | Baseline (Task 1) | 11 | 712.6 | 195.0 | — |
| `/dashboard` | Baseline (Task 1) | 19 | 1390.6 | 402.6 | — |
| `/accounts/invoices` | Baseline (Task 1) | 20 | 1075.1 | 317.2 | — |
| `/accounts/bank` | Baseline (Task 1) | 21 | 1118.1 | 329.3 | — |
| `/accounts/expenses` | Baseline (Task 1) | 20 | 1075.0 | 318.2 | — |
| `/dashboard` | Lazy Recharts (Task 3) | 19 | 1007.8 | 294.4 | -108.2 kB (-26.9%) |
| `/dashboard` | Shell Code-Split (Task 5) | 19 | 966.6 | 281.9 | -120.7 kB (-30.0%) |
| `/accounts/invoices` | Shell Code-Split (Task 5) | 21 | 1071.9 | 316.1 | -1.1 kB (-0.3%) |
| `/accounts/bank` | Shell Code-Split (Task 5) | 23 | 1115.1 | 328.9 | -0.4 kB (-0.1%) |
| `/accounts/expenses` | Shell Code-Split (Task 5) | 21 | 1071.7 | 317.2 | -1.0 kB (-0.3%) |
| `/login` | Final (Task 12) | 11 | 712.8 | 194.8 | -0.2 kB (-0.1%) |
| `/dashboard` | Final (Task 12) | 19 | 966.6 | 281.9 | -120.7 kB (-30.0%) |
| `/accounts/invoices` | Final (Task 12) | 21 | 1072.9 | 316.5 | -0.7 kB (-0.2%) |
| `/accounts/bank` | Final (Task 12) | 23 | 1115.9 | 329.3 | 0.0 kB (0.0%) |
| `/accounts/expenses` | Final (Task 12) | 21 | 1072.7 | 317.6 | -0.6 kB (-0.2%) |

---

## Lighthouse Lab Results (`throttlingMethod: "simulate"`)

| Label | Route | Form Factor | Perf | FCP (ms) | LCP (ms) | TBT (ms) | CLS | TTFB (ms) | SI (ms) | Notes |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| `baseline-login` | `/login` | mobile | 58 | 1081 | 2973 | 139093 | 0 | 352 | 6770 | Local `next start`; continuous canvas/rAF background on `/login` inflates simulated TBT |
| `baseline-login` | `/login` | desktop | 42 | 1066 | 3171 | 146526 | 0 | 17 | 3766 | Local `next start`; continuous canvas/rAF background on `/login` inflates simulated TBT |
| `final-login` | `/login` | mobile | 52 | 1099 | 3477 | 141294 | 0 | 658 | 9074 | Local cold `next start` first hit (`ttfb: 658 ms`); `cls: 0`; `/login` canvas loop untouched |
| `final-login` | `/login` | desktop | 42 | 1078 | 2993 | 147162 | 0 | 22 | 4572 | Warm server (`ttfb: 22 ms`, `lcp: 2993 ms`, `cls: 0`); `/login` canvas loop untouched |
| `baseline-dashboard` | `/dashboard` | mobile | — | — | — | — | — | — | — | Pending owner `PERF_COOKIE` run against preview/local |
| `baseline-dashboard` | `/dashboard` | desktop | — | — | — | — | — | — | — | Pending owner `PERF_COOKIE` run against preview/local |
| `final-dashboard` | `/dashboard` | mobile | — | — | — | — | — | — | — | Run `PERF_COOKIE="..." npm run perf:lh -- <url>/dashboard final-dashboard` |
| `final-dashboard` | `/dashboard` | desktop | — | — | — | — | — | — | — | Run `PERF_COOKIE="..." npm run perf:lh -- <url>/dashboard final-dashboard` |

### Metrics Over Budget (Logged for Follow-Up)

The following items remain above target budgets on `/login` or require post-deploy verification and are logged as follow-ups outside this speed package:
1. **`/login` simulated TBT (`~141–147 s`) & FCP (`~1.08–1.10 s`):** Driven by continuous `requestAnimationFrame` / canvas drawing on the `/login` screen, which keeps the main thread busy throughout Lighthouse's quiet-window wait and slightly delays simulated mobile LCP (`3477 ms` on cold hit, `2993 ms` desktop). `/login` animation behavior was out of scope for this package; evaluate frame-throttling or `prefers-reduced-motion` gating in a dedicated follow-up if needed.
2. **Authenticated `/dashboard` & `/accounts/*` lab + field runs:** Authenticated session cookies were not available in the automated build environment. Run `perf:lh` with `PERF_COOKIE` against the Vercel `sin1` preview deployment after applying the two additive migrations, and monitor real-user `/api/vitals` logs in Vercel (`LCP`, `INP`, `CLS`, `FCP`, `TTFB`).
3. **Remaining unpaged lists (planned follow-up):** Vendor invoices, income, leads, and PO expenses remain on their existing loaders per scope; AR/AP keep full open-item sets for aging bucket accuracy (covered by the new `issued_on` / `status` indexes).

---

## Database Migration & Production Rollout Notes

**Wait for explicit owner approval before applying migrations to production.**

1. **`supabase/migrations/20261105120000_perf_indexes.sql` (12 additive indexes):**
   - Uses `create index if not exists` so `supabase db push` / MCP apply works transactionally.
   - For a large live production database, the owner may optionally run equivalent `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` statements outside a transaction in the Supabase SQL Editor before marking the migration applied, avoiding write locks.
   - Post-apply check (expect `12`):
     ```sql
     select count(*)
     from pg_indexes
     where schemaname = 'public'
       and indexname in (
         'client_invoices_issued_on_idx',
         'client_invoices_client_issued_idx',
         'client_invoices_project_issued_idx',
         'vendor_invoices_issued_on_idx',
         'vendor_invoices_status_issued_idx',
         'operational_expenses_expense_date_idx',
         'bank_transactions_account_date_idx',
         'bank_transactions_transaction_date_idx',
         'leads_added_on_idx',
         'leads_status_added_on_idx',
         'projects_year_idx',
         'projects_status_idx'
       );
     ```
   - Re-run `EXPLAIN ANALYZE` on date-ordered list/range queries (`client_invoices`, `bank_transactions`, `operational_expenses`) and confirm `Index Scan` / `Bitmap Index Scan` replaces `Seq Scan`.

2. **`supabase/migrations/20261105121000_dashboard_details_rpc.sql` (`public.dashboard_details`):**
   - Consolidates the four secondary dashboard performance queries (`operational_expenses` monthly categories, `projects` counts, `leads` pipeline counts, and `assets` depreciated book value) into a single `security definer` RPC (`search_path = public, pg_temp`, `authenticated` only).
   - `getDashboard` (`src/lib/dashboard-data.ts`) automatically falls back to the 4-query TypeScript loader if `dashboard_details` has not been applied yet, and fails closed if `dashboard_scope` is missing unless `DASHBOARD_TABLE_FALLBACK=1` is explicitly set. Leave `DASHBOARD_TABLE_FALLBACK` **unset** in production once RPCs are live.

---

## Release Note (Speed Package — Pre-`1.1.0`)

- **Versioning:** `package.json` intentionally remains at `"version": "1.0.0"` until the full `1.1.0` feature set ships.
- **Summary of speed changes:**
  - Service worker upgraded to `atrium-v3` with an 80-entry FIFO cap on static assets (`/_next/static/*`, icons, fonts), registered after `window` `load`; HTML navigations, `/api/*`, and Supabase/financial requests are never cached, with `/offline.html` fallback for offline navigations.
  - `recharts` split out of the initial `/dashboard` and project summary bundles via `next/dynamic(..., { ssr: false })`, and shell header menus/search (`GlobalSearch`, `DocumentsMenu`, `ReportsMenu`) lazy-loaded alongside `optimizePackageImports: ["lucide-react", "recharts"]`, cutting `/dashboard` initial entry JS from `402.6 kB` to `281.9 kB` gzip (`-30.0%`).
  - `/dashboard` streams behind `<Suspense>` with `DashboardSkeleton` and parallel cached auth (`getCurrentUser` + `requireModule` + `getAccess`), backed by the new `dashboard_details` RPC and fail-closed `dashboard_scope` handling.
  - Client invoices (`/accounts/invoices`), bank transactions (`/accounts/bank`), and operational expenses (`/accounts/expenses`) now use server-side pagination (`LIST_PAGE_SIZE = 50`, `count: "exact"`, `PGRST103` out-of-range clamping), `<ListPager prefetch={false}>`, and 300ms debounced URL search (`?q=...`), while preserving exact bank account closing/running balances and statement/reconcile report views.

### Owner Click-Test Checklist

- [ ] **Dashboard streaming:** Navigate to `/dashboard` (and switch `?year=` scope); verify `DashboardSkeleton` renders immediately and transitions cleanly into KPI cards and summary sections without layout shift.
- [ ] **Lazy charts:** Verify sparklines, weekly cashflow, expense donut, annual chart, and project summary trend chart render after their dimension-matched skeletons.
- [ ] **Deferred shell controls:** Open Global Search (`Ctrl+K` / `Cmd+K` and header button), Documents menu, and Reports menu; verify each loads on demand and navigates normally.
- [ ] **Client invoices paging & search (`/accounts/invoices`):** Verify 50-row pages, `<ListPager>` links (`?page=2`), debounced `?q=` URL search without losing input focus, project filter (`?project=`), and status filter chips.
- [ ] **Bank transactions paging, search & balances (`/accounts/bank`):** Verify 50-row transaction pages, `?account=` filter, debounced `?q=` search on notes, **unchanged account balance cards and per-row running balances**, and unchanged Statement / Reconcile views.
- [ ] **Operational expenses paging & search (`/accounts/expenses`):** Verify 50-row pages, debounced `?q=` search across category/notes/payment method, and non-project Operational PO rows still appearing accurately.
- [ ] **Offline fallback:** In DevTools Network → Offline, trigger a page navigation and confirm `/offline.html` renders cleanly; reconnect and confirm live pages load normally.
- [ ] **No stale financials:** Record or edit a test transaction/invoice/expense, refresh or navigate back to `/dashboard` and `/accounts/bank`, and confirm updated figures appear immediately (never served from SW cache).
- [ ] **Excel & exports unchanged:** Trigger `ListExport` / Excel / PDF / statement exports from invoices, bank, expenses, and reports; confirm output matches pre-change behavior.
