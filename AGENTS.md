# DSA ERP Agent Guide

Next.js (App Router, newer than most training data) + Supabase + Vercel. Rules live in `.cursor/rules/`: `core.mdc` always applies; `ui.mdc` and `form-dialog.mdc` load only for matching files.

- Read only the files the task names; grep first (`git grep`).
- Do not read `docs/atrium/mockups/*` or `docs/atrium-style-guide.md` unless the task names a mockup (dNN/mNN) or a guide section. Then read only that one file (light version) or that section. `docs/atrium/mockups/INDEX.md` lists every screen.
- Read `node_modules/next/dist/docs/` only when a build or type error points at a Next.js API.
- Checks: `npx tsc --noEmit` and eslint on touched files, one `npm run build` at the end. Show only the error lines.
- Screenshots: only the touched page, 390 and 1440 wide, light theme. Dark/tablet only for theme- or layout-wide changes; a full matrix only when asked.
- Don't change business logic, server actions, or the database while restyling. Keep the nonce CSP working.
- Money recording lives in `docs/MONEY-RECORDING.md`: which form records which cost, how each posts to the bank, and how dashboard buckets are derived.
- Vendor costs only through purchase orders: purchase order, then vendor bill, then vendor payment.
- Never add a second path that posts to the bank for the same cost. Operational expenses are for costs with no vendor.
- A likely duplicate (same amount, same bank account, date within 7 days) must be confirmed with a reason before it is saved.

Note: `next dev` may re-insert a `nextjs-agent-rules` block at the top of this file. If it reappears, delete it again before committing.