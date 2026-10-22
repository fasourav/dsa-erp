# Money Recording

One cost, one bank outflow. Do not record the same cost twice.

## Which form

- **Operational Expense** (`/accounts/expenses`): a company cost with no vendor, such as rent or office supplies. Category comes from Office Expense Categories.
- **Purchase Order** (`/purchase-orders`): any cost that has a vendor, project or operational. Operational purchase orders have no project.
- **Vendor bill**: the amount owed on that purchase order.
- **Vendor payment**: money paid against the bill.
- **Client invoice and client payment**: money in. Not a cost.
- **Payroll**: salary paid to employees.
- **VAT/Tax payment**: tax paid to the authority.

Vendor costs only go purchase order, then vendor bill, then vendor payment. The Operational Expense form has no vendor picker. Existing operational expense rows that already have a vendor stay on the list and can still be read. New rows cannot set a vendor, and an edit cannot change `vendor_id`.

## Bank ledger

Saving posts one outflow. The triggers keep the bank line in step with the source row.

- An operational expense runs `sync_operational_expense_bank_tx`: outflow, source `operational_expense`, date `expense_date`, amount and bank account from the expense, linked by `operational_expense_id`.
- A vendor payment runs `sync_vendor_payment_bank_tx`: outflow, source `vendor_expense`, date `paid_on`, linked by `vendor_payment_id`. The project, when there is one, comes from the purchase order.
- Payroll posts an outflow with source `payroll`. A VAT/Tax payment posts its own outflow. A client payment posts an inflow.

Deleting the source removes its bank line. Do not also enter an operational expense for a cost that already has a vendor payment.

## Dashboard buckets

Buckets are summed in `expenseTotals` (`src/lib/dashboard-metrics.ts`). This note describes them. It does not change the formulas.

- **Material** and **Subcontractor**: vendor payments whose purchase order has a project. Material when the purchase order expense category, or otherwise the work type, contains material, supply, or goods. Otherwise subcontractor.
- **Operational**: vendor payments on a purchase order with no project, plus operational expenses with no project whose category is not salary, marketing, or admin.
- **Project overhead**: operational expenses linked to a project. They are not also counted as operational, salary, admin, or marketing.
- **Salary**: operational expenses with no project whose category contains salary, payroll, or wage, plus payroll outflows on the bank ledger.
- **Marketing**: operational expenses with no project whose category contains market, advert, or promotion.
- **Admin**: operational expenses with no project whose category contains admin, office, rent, or utilit (utilities). Office materials stay here, not in Material.
- **Tax**: VAT/Tax payments. Counted in gross profit, not in project expense.

Project expense is material + subcontractor + project overhead. The admin expense total is operational + marketing + salary + admin. Gross profit is client collections minus project expense minus tax. Net profit subtracts the admin expense total.

## Duplicates

Before an operational expense or a vendor payment is saved, the server looks for another operational expense or vendor payment with the same amount, the same bank account, and a date within 7 days. The form lists each match (type, date, amount, vendor or category). Saving then requires **This Is Not A Duplicate** and a reason. The reason is stored at the start of notes as `Duplicate override: `.

The database rejects an operational expense insert, or an update that sets or changes `vendor_id`. Apply `supabase/migrations/20261023150000_operational_expense_no_vendor.sql` before using the new columns. It does not update or delete existing rows.

To list likely duplicates already in the data, run `docs/duplicate-money-scan.sql` in the SQL editor. It is read-only.
