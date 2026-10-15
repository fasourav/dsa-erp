# TEST smoke report

Project: `https://aomofxkglixqijtqywfp.supabase.co` (TEST). Live ref `daokeubxsqlvstaxqcgl` was not used. Keys and passwords were present and are not recorded here.

## Env check

| Check | Result |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | TEST host `aomofxkglixqijtqywfp` |
| Live host present | No |
| Anon key, service role, three passwords | Set |

## Build / typecheck

- `npm ci`: succeeded (785 packages).
- `npm run typecheck` (`tsc --noEmit`): passed.
- `npm run lint`: passed.
- `npm run build`: passed (Next.js 16.4.0).

## Logins

Password grant `POST /auth/v1/token?grant_type=password` for each user. HTTP 200 and an access token for all three.

| User | Email | Profile role | Status | show_financials |
| --- | --- | --- | --- | --- |
| Owner | fardin.ahsan10@gmail.com | owner | active | true |
| Accountant | fardin.sourav@northsouth.edu | accountant | active | true |
| Staff | fasrv911@gmail.com | staff | active | false |

Owner can read all three profile rows. Accountant and staff can read only their own row. Anon `GET /rest/v1/profiles` returns `200 []`.

## Endpoint checks

Each call used that role's user JWT and the anon key. Counts use `Prefer: count=exact`.

| Endpoint | Owner | Accountant | Staff |
| --- | --- | --- | --- |
| `rpc/dashboard_scope` `{p_year:null}` | 200, full object, payables 0, receivables 0, cash 0 | 200, JSON `null` | 200, JSON `null` |
| `projects?select=id,name,status,total_value&limit=3` | 200, 0 rows | 200, 0 rows | 200, 0 rows |
| `accounts_payable?select=id,pending_payable&limit=3` | 200, 0 rows | 200, 0 rows | 200, 0 rows |
| `vendor_invoices?select=id,amount,status&limit=3` | 200, 0 rows | 200, 0 rows | 200, 0 rows |
| `client_invoices?select=id,amount,status&limit=3` | 200, 0 rows | 200, 0 rows | 200, 0 rows |
| `project_financials?select=project_id,total_value,gross_profit&limit=1` | 200, 0 rows | 200, 0 rows | 200, 0 rows |
| `vendor_purchase_orders?select=id,issued_on,total_value&limit=1` | 200, 0 rows | not repeated | not repeated |
| `rpc/financial_report` 2026-01-01..2026-10-15 | 200, object with 10 keys | 200, `allowed: true`, every section `null` | 200, `{allowed:false}` |
| `rpc/search_records` `{query:"test"}` | 403 `42501` permission denied for schema private | 403 same | 403 same |
| `rpc/vendor_statement` (nil vendor, 2026 range) | 403 same | not repeated | not repeated |
| `rpc/client_statement` (nil client, 2026 range) | 403 same | not repeated | not repeated |
| `company_settings?select=id,launch_date` | 200, 1 row | 200, 1 row | 200, 1 row |
| `clients`, `vendors`, `leads` limit 1 | 200, 0 rows | 200, 0 rows | 200, 0 rows |

`dashboard_scope` returns null unless `private.sees_financials()` and `private.can(..., 'view')` pass for every dashboard source module. Staff fails the financials flag. Accountant has `show_financials` but every `user_permissions.can_view` is false, so `can()` fails and the RPC returns null. The dashboard page treats that as the limited dashboard when `hasFullDashboardAccess` is false, which matches these flags.

Service-role `search_records` returns the same 403. Service-role `dashboard_scope` returns null because there is no `auth.uid()`.

Dev server and browser were not started.

## Bug list

### BUG-1 High — invoker RPCs cannot enter schema private

- Repro: sign in as owner (also staff, accountant, and the service role) and `POST /rest/v1/rpc/search_records` with `{"query":"test"}`. Same result for `vendor_statement` and `client_statement`.
- Expected: HTTP 200. Search returns a list (empty on this dataset). Statements return JSON, including `{"allowed":false}` when the id is unknown.
- Actual: HTTP 403, `code` `42501`, `message` `permission denied for schema private`.
- Cause: those functions are `SECURITY INVOKER` and call `private.*`. API roles on TEST do not have usable `USAGE` on schema `private`. Migrations `20261012140000` and `20261013211000` already grant it.
- Fix in this branch: `supabase/migrations/20261019100000_restore_private_schema_usage.sql` re-grants `USAGE` to `authenticated` and `service_role`. Not applied to TEST.

### BUG-2 High — every role template and user grant is view/add/edit/delete false

- Repro: as owner, `GET /rest/v1/role_template_permissions?select=module,can_view,can_add` and `GET /rest/v1/user_permissions?select=module,can_view,can_add,can_edit,can_delete`.
- Expected: owner template all true; accountant and staff templates match the seeds in `20261012140000_users_permissions.sql` (accountant can view dashboard, projects, invoices, banking, and the other seeded modules; staff can view dashboard, leads, clients, projects, and the other seeded modules).
- Actual: 96 template rows and 72 user rows, and every flag is false. Owner still passes `private.can()` because that function returns true for an active owner. Accountant and staff pass nothing, so `dashboard_scope` is null and `financial_report` has no sections.
- Not changed. The template rows themselves are false, so this is TEST data, not a one-line code bug. No rows were updated.

### BUG-3 Low — no business documents on TEST

Projects, clients, vendors, leads, purchase orders, vendor invoices, client invoices, accounts payable, and project financials are empty for the owner. Dashboard totals are zero. Treated as an empty dataset, not a defect.

## PR

See the draft PR for `cursor/test-smoke-private-usage-3fac`. Migration is not applied.
