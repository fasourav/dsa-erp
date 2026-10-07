import { fetchAllPages, fetchByIds } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isPaymentStatus } from "@/lib/payment-status"
import type { PoExpenseRow } from "@/lib/po-expenses"
import { createClient } from "@/lib/supabase/server"

export async function getPoExpenses(): Promise<{
  rows: PoExpenseRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const expenses = await fetchAllPages(
      (from, to) =>
        supabase
          .from("project_expenses")
          .select("expense_id, project_name, vendor_name, total_expense")
          .order("expense_id", { ascending: true })
          .range(from, to),
      "Expense list is larger than expected.",
    )

    const expenseIds = expenses.flatMap((expense) =>
      expense.expense_id ? [expense.expense_id] : [],
    )

    const [payments, transactions] = await Promise.all([
      fetchByIds(expenseIds, (ids) =>
        supabase
          .from("vendor_payments")
          .select("id, vendor_invoice_id, bank_account_id")
          .in("id", ids),
      ),
      fetchByIds(expenseIds, (ids) =>
        supabase
          .from("bank_transactions")
          .select("vendor_payment_id, bank_account_id")
          .in("vendor_payment_id", ids),
      ),
    ])

    const invoices = await fetchByIds(
      payments.map((payment) => payment.vendor_invoice_id),
      (ids) =>
        supabase.from("vendor_invoices").select("id, status").in("id", ids),
    )

    const accountIds = [
      ...payments.map((payment) => payment.bank_account_id),
      ...transactions.flatMap((transaction) =>
        transaction.bank_account_id ? [transaction.bank_account_id] : [],
      ),
    ]
    const accounts = await fetchByIds(accountIds, (ids) =>
      supabase.from("bank_accounts").select("id, name").in("id", ids),
    )

    const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
    const paymentById = new Map(payments.map((payment) => [payment.id, payment]))
    const ledgerAccountByPayment = new Map<string, string>()
    for (const transaction of transactions) {
      if (!transaction.vendor_payment_id || !transaction.bank_account_id) {
        continue
      }

      ledgerAccountByPayment.set(
        transaction.vendor_payment_id,
        transaction.bank_account_id,
      )
    }

    const accountNames = new Map(
      accounts.map((account) => [account.id, account.name.trim()]),
    )

    const rows = expenses.flatMap((expense) => {
      if (!expense.expense_id) {
        return []
      }

      const payment = paymentById.get(expense.expense_id)
      const invoice = payment
        ? invoiceById.get(payment.vendor_invoice_id)
        : undefined
      if (
        !payment ||
        !invoice ||
        !isPaymentStatus(invoice.status) ||
        invoice.status === "void" ||
        invoice.status === "unpaid"
      ) {
        return []
      }

      const accountId =
        ledgerAccountByPayment.get(payment.id) || payment.bank_account_id

      return [
        {
          id: expense.expense_id,
          projectName: expense.project_name?.trim() ?? "",
          vendorName: expense.vendor_name?.trim() ?? "",
          expenseAmount: toNumber(expense.total_expense),
          bankingChannel: accountNames.get(accountId) ?? "",
        } satisfies PoExpenseRow,
      ]
    })

    return { rows, error: null }
  } catch {
    return { rows: [], error: "Could not load expenses." }
  }
}
