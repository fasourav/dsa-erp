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
npm run perf:lh -- http://localhost:3000/login baseline-login

# Authenticated route (pass session cookie via PERF_COOKIE)
PERF_COOKIE="sb-...=..." npm run perf:lh -- http://localhost:3000/dashboard baseline-dashboard
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

---

## Lighthouse Lab Results (`throttlingMethod: "simulate"`)

| Label | Route | Form Factor | Perf | FCP (ms) | LCP (ms) | TBT (ms) | CLS | TTFB (ms) | SI (ms) | Notes |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| `baseline-login` | `/login` | mobile | 58 | 1081 | 2973 | 139093 | 0 | 352 | 6770 | Local `next start`; continuous canvas/rAF background on `/login` inflates simulated TBT |
| `baseline-login` | `/login` | desktop | 42 | 1066 | 3171 | 146526 | 0 | 17 | 3766 | Local `next start`; continuous canvas/rAF background on `/login` inflates simulated TBT |
| `baseline-dashboard` | `/dashboard` | mobile | — | — | — | — | — | — | — | Pending authenticated `PERF_COOKIE` run |
| `baseline-dashboard` | `/dashboard` | desktop | — | — | — | — | — | — | — | Pending authenticated `PERF_COOKIE` run |
