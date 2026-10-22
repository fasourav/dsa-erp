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

Buckets are summed in `expenseTotals` (`src/lib/dashboard-metrics.ts`). This note describes them. It does not change the formulas.

- **Material** and **Subcontractor**: vendor payments whose purchase order has a project, and, on the accrual report, vendor bills on a project purchase order. Material when the purchase order expense category, or otherwise the work type, contains material, supply, or goods. Otherwise subcontractor. Cash and accrual use that same split.
- **Operational**: payments (cash) or bills (accrual) on a purchase order with no project whose office expense category, or otherwise the work type, or otherwise Operational, is not salary, marketing, or admin, plus operational expenses with no project in that same bucket.
- **Project overhead**: operational expenses linked to a project. They are not also counted as operational, salary, admin, or marketing.
- **Salary**: operational expenses with no project whose category contains salary, payroll, or wage, plus the same match on an operational purchase order's office category (then work type), plus payroll outflows on the bank ledger.
- **Marketing**: operational expenses with no project whose category contains market, advert, or promotion, plus the same match on an operational purchase order.
- **Admin**: operational expenses with no project whose category contains admin, office, rent, or utilit (utilities), plus the same match on an operational purchase order. Office materials stay here, not in Material.
- **Tax**: VAT/Tax payments. Counted in gross profit, not in project expense.

Project expense is material + subcontractor + project overhead. The admin expense total is operational + marketing + salary + admin. Gross profit is client collections minus project expense minus tax. Net profit subtracts the admin expense total.

## Dashboard figures

These two cards are calculated in the app from figures the dashboard already loads (`collectionEfficiencyOf` and `forecastedProfitOf` in `src/lib/dashboard-metrics.ts`). The screen uses those results. Other profit, expense, receivable, and payable totals are unchanged.

- **Collection Efficiency** = (Total Revenue − Accounts Receivable) / Total Revenue, shown as a percent. Total Revenue is the dashboard revenue for the selected period. Accounts Receivable is the open client balance: current when the period is All Time or the current year, otherwise as of that year end. Total Revenue of zero shows 0%.
- **Forecasted Profit** = Accounts Receivable − Accounts Payable. Accounts Payable is open vendor bills, the same balance as the Accounts Payable card.
- The period selector opens on **All Time**. A chosen fiscal year still limits the period figures.
- Project overhead stays in project expense and in the Expense Summary amount. That row does not show a percent.
- **Asset Value** on the dashboard is the Assets page Total Asset Value. Both use `assetValue` and `sumAssetCurrentValue` in `src/lib/asset-value.ts`: straight-line depreciation from purchase date, cost, and lifespan, then the sum of those current values.
- **Backlog value** is the sum of `project_backlogs.backlog_amount` for backlog projects in the selected period. It is shown beside the backlog count when that count is greater than zero.

## Duplicates

Before an operational expense or a vendor payment is saved, the server looks for another operational expense or vendor payment with the same amount, the same bank account, and a date within 7 days. The form lists each match (type, date, amount, vendor or category). Saving then requires **This Is Not A Duplicate** and a reason. The reason is stored at the start of notes as `Duplicate override: `.

The database rejects an operational expense insert, or an update that sets or changes `vendor_id`. Apply `supabase/migrations/20261023150000_operational_expense_no_vendor.sql` before using the new columns. It does not update or delete existing rows.

Apply `supabase/migrations/20261023203000_operational_po_office_category.sql` after that. It adds nullable `office_expense_category_id` on purchase orders, buckets operational purchase-order payments and bills with the office category, labels cash-flow vendor payments with no project as Operational Expenses, and renumbers operational purchase-order document numbers from project code NA to OPS. Previous numbers are copied into `private.bak_20261023_po_numbers` first. It does not drop or rename columns.

The Operational Expense page also lists payments on operational purchase orders as read-only rows marked From Operational PO, with a link to the purchase order. For one period, those rows plus operational expenses that have no project equal dashboard Operational + Admin + Marketing + Employee Salary, except payroll outflows, which stay on the bank ledger and in Employee Salary. A duplicate warning shows the vendor's company name when it is set, and otherwise the person name.

To list likely duplicates already in the data, run `docs/duplicate-money-scan.sql` in the SQL editor. It is read-only.
