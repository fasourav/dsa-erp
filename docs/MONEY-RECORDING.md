# Money Recording

One cost, one bank outflow. Do not record the same cost twice.

## Which form

- **Operational Expense** (`/accounts/expenses`): a company cost with no vendor, such as rent or office supplies. Category comes from Office Expense Categories.
- **Purchase Order** (`/purchase-orders`): any cost that has a vendor, project or operational. Operational purchase orders have no project. A new operational purchase order requires an office expense category (the same list as Operational Expense, such as Employee Salary, Office Rent, Office Materials, or Legal). A project purchase order still requires a project expense category.
- **Vendor bill**: the amount owed on that purchase order.
- **Vendor payment**: money paid against the bill. The payment form does not ask for a category. It shows the purchase order's category as read-only text: the project expense category on a project purchase order, and the office expense category on an operational purchase order. The server stores that name on `vendor_payments.expense_category` for display.
- **Client invoice and client payment**: money in. Not a cost.
- **Payroll**: salary paid to employees.
- **VAT/Tax payment**: tax paid to the authority.

Vendor costs only go purchase order, then vendor bill, then vendor payment. The Operational Expense form has no vendor picker. Existing operational expense rows that already have a vendor stay on the list and can still be read. New rows cannot set a vendor, and an edit cannot change `vendor_id`.

## Bank ledger

Saving posts one outflow. The triggers keep the bank line in step with the source row.

- An operational expense runs `sync_operational_expense_bank_tx`: outflow, source `operational_expense`, date `expense_date`, amount and bank account from the expense, linked by `operational_expense_id`.
- A vendor payment runs `sync_vendor_payment_bank_tx`: outflow, source `vendor_expense`, date `paid_on`, linked by `vendor_payment_id`. The project, when there is one, comes from the purchase order. The bank ledger labels a vendor payment whose purchase order has no project as Operational Expense (PO). A vendor payment on a project stays Vendor Expense.
- Payroll posts an outflow with source `payroll`. A VAT/Tax payment posts its own outflow. A client payment posts an inflow.

Deleting the source removes its bank line. Do not also enter an operational expense for a cost that already has a vendor payment.

## Dashboard buckets

The dashboard sums cash in `private.report_profit`, through `private.dashboard_components`. The Financial Report profit and loss uses the same buckets on an accrual basis in `private.report_profit_accrual`. Office costs use the category's report group. The app fallback in `expenseTotals` (`src/lib/dashboard-metrics.ts`) uses the same rule.

Each office expense category has a required report group: Operational Expense (`operational`), Marketing (`marketing`), or Salary (`salary`). There is no admin group. Settings stores the group. The forms show it as read-only text, "Counts as Operational Expense (part of Admin Expense)", after a category is chosen.

Admin Expense is the total of those three groups. It is not a category and not a fourth bucket. The dashboard Expense Summary and the Financial Report profit and loss show that total, then Operational, Marketing, and Salary underneath it. Depreciation stays on the Financial Report and inside that report's Admin Expense subtotal. There is no Office And Admin line.

An operational expense is stored with a category name, not a category id. Its group is resolved in this order:

1. The office expense category with the same name, using that category's report group.
2. If no category matches, the department name through the keyword rule.
3. If there is no department either, the keyword rule on the category name.

The keyword rule, still available as `private.report_admin_bucket`, is: salary, payroll, or wage means salary; market, advert, or promotion means marketing; admin, office, rent, or utilit (utilities) means admin; otherwise operational. Reports do not use that admin result. `private.report_office_group` maps it to operational. `report_admin_bucket` is not removed, so older callers keep working.

An operational purchase order payment (cash) or bill (accrual) uses the purchase order's office category report group. If that category is missing, it uses the work type through the keyword rule, and otherwise Operational. A project purchase order does not use this group.

- **Material** and **Subcontractor**: vendor payments whose purchase order has a project, and, on the accrual report, vendor bills on a project purchase order. Material when the purchase order expense category, or otherwise the work type, contains material, supply, or goods. Otherwise subcontractor. Cash and accrual use that same split.
- **Operational**: payments (cash) or bills (accrual) on a purchase order with no project whose resolved group is operational, plus operational expenses with no project in that same group. Office rent, office materials, legal, and internet bill are operational.
- **Project overhead**: operational expenses linked to a project. They are not also counted as operational, salary, or marketing.
- **Salary**: operational expenses with no project whose resolved group is salary, plus operational purchase orders in that group, plus payroll outflows on the bank ledger.
- **Marketing**: operational expenses with no project whose resolved group is marketing, plus operational purchase orders in that group.
- **Tax**: VAT/Tax payments. Counted in gross profit, not in project expense.

Project expense is material + subcontractor + project overhead. Admin Expense is operational + marketing + salary. The profit JSON still has an `admin` key so existing sums keep working. That key is zero, because no row resolves to admin, and it is not shown as its own line. Adding it again would double-count. Gross profit is client collections minus project expense minus tax. Net profit subtracts Admin Expense. On the Financial Report, Admin Expense also includes depreciation, as it did before.

## Dashboard figures

These two cards are calculated in the app from figures the dashboard already loads (`collectionEfficiencyOf` and `forecastedProfitOf` in `src/lib/dashboard-metrics.ts`). The screen uses those results. Other profit, expense, receivable, and payable totals are unchanged.

- **Collection Efficiency** = (Total Revenue − Accounts Receivable) / Total Revenue, shown as a percent. Total Revenue is the dashboard revenue for the selected period. Accounts Receivable is the open client balance: current when the period is All Time or the current year, otherwise as of that year end. Total Revenue of zero shows 0%.
- **Forecasted Profit** = Accounts Receivable − Accounts Payable. Accounts Payable is open vendor bills, the same balance as the Accounts Payable card.
- The period selector opens on **All Time**. A chosen fiscal year still limits the period figures.
- Project overhead stays in project expense and in the Expense Summary total. The summary list does not show a Project Overhead row.
- **High Value** and **Low Value** counts use ৳50,000 of project value. At or above that is high; below it is low. The card shows those counts only.
- **Asset Value** on the dashboard is the Assets page Total Asset Value, for accounts that can view Assets (including the owner). Both use `assetValue` and `sumAssetCurrentValue` in `src/lib/asset-value.ts`: straight-line depreciation from purchase date, cost, and lifespan, then the sum of those current values. The card stays hidden without that permission. If the asset, project, or backlog lookup fails, the figure shows — rather than ৳0.
- **Backlog value** is the sum of `project_backlogs.backlog_amount` for backlog projects in the selected period. It is shown beside the backlog count when that count is greater than zero.

## Duplicates

Before an operational expense or a vendor payment is saved, the server looks for another operational expense or vendor payment with the same amount, the same bank account, and a date within 7 days. The form lists each match (type, date, amount, vendor or category). Saving then requires **This Is Not A Duplicate** and a reason. The reason is stored at the start of notes as `Duplicate override: `.

The database rejects an operational expense insert, or an update that sets or changes `vendor_id`. Apply `supabase/migrations/20261023150000_operational_expense_no_vendor.sql` before using the new columns. It does not update or delete existing rows.

Apply `supabase/migrations/20261023203000_operational_po_office_category.sql` after that. It adds nullable `office_expense_category_id` on purchase orders, buckets operational purchase-order payments and bills with the office category, labels cash-flow vendor payments with no project as Operational Expenses, and renumbers operational purchase-order document numbers from project code NA to OPS. Previous numbers are copied into `private.bak_20261023_po_numbers` first. It does not drop or rename columns.

Apply `supabase/migrations/20261023233000_office_expense_report_group.sql` after that. It adds `report_group` on office expense categories, backfills the current rows (Employee Salary is salary; Office Rent, Office Materials, Legal, and Internet Bill are operational; any other row follows the keyword rule, with admin counting as operational), and points the cash and accrual profit functions at that group. The Financial Report drops the Office And Admin line. Admin Expense stays the subtotal. It does not drop `report_admin_bucket` or delete rows. The Settings page, the Operational Expense form, and the operational purchase order form read the new column, so apply this before using those screens.

The Operational Expense page also lists payments on operational purchase orders as read-only rows marked From Operational PO, with a link to the purchase order. For one period, those rows plus operational expenses that have no project equal Admin Expense, except payroll outflows, which stay on the bank ledger and in Salary. A duplicate warning shows the vendor's company name when it is set, and otherwise the person name.

To list likely duplicates already in the data, run `docs/duplicate-money-scan.sql` in the SQL editor. It is read-only.
