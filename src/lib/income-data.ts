import { fetchAllPages, fetchByIds } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { settlePaidInvoice, type IncomeRow } from "@/lib/income"
import { createClient } from "@/lib/supabase/server"

export async function getIncome(): Promise<{
  rows: IncomeRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const invoices = await fetchAllPages(
      (from, to) =>
        supabase
          .from("client_invoices")
          .select("id, amount, project_id")
          .eq("status", "paid")
          .order("id", { ascending: true })
          .range(from, to),
      "Income list is larger than expected.",
    )

    const projectIds = invoices.map((invoice) => invoice.project_id)
    const invoiceIds = invoices.map((invoice) => invoice.id)

    const [projects, payments] = await Promise.all([
      fetchByIds(projectIds, (ids) =>
        supabase.from("projects").select("id, name, project_type").in("id", ids),
      ),
      fetchByIds(invoiceIds, (ids) =>
        supabase
          .from("client_payments")
          .select("id, client_invoice_id, paid_on, bank_account_id")
          .in("client_invoice_id", ids),
      ),
    ])

    const transactions = await fetchByIds(
      payments.map((payment) => payment.id),
      (ids) =>
        supabase
          .from("bank_transactions")
          .select("income_id, transaction_date, bank_account_id")
          .in("income_id", ids),
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

    const projectById = new Map(projects.map((project) => [project.id, project]))
    const paymentsByInvoice = new Map<string, typeof payments>()
    for (const payment of payments) {
      const group = paymentsByInvoice.get(payment.client_invoice_id) ?? []
      group.push(payment)
      paymentsByInvoice.set(payment.client_invoice_id, group)
    }

    const ledgerByPayment = new Map<
      string,
      { transactionDate: string; bankAccountId: string }
    >()
    for (const transaction of transactions) {
      if (!transaction.income_id) {
        continue
      }

      ledgerByPayment.set(transaction.income_id, {
        transactionDate: transaction.transaction_date,
        bankAccountId: transaction.bank_account_id ?? "",
      })
    }

    const accountNames = new Map(
      accounts.map((account) => [account.id, account.name]),
    )

    const rows = invoices.map((invoice) => {
      const project = projectById.get(invoice.project_id)
      const invoicePayments = paymentsByInvoice.get(invoice.id) ?? []
      const settled = settlePaidInvoice(
        invoicePayments.map((payment) => ({
          id: payment.id,
          paidOn: payment.paid_on,
          bankAccountId: payment.bank_account_id,
        })),
        ledgerByPayment,
        accountNames,
      )

      return {
        id: invoice.id,
        projectName: project?.name.trim() ?? "",
        projectType: project?.project_type?.trim() ?? "",
        invoiceAmount: toNumber(invoice.amount),
        bankingChannel: settled.bankingChannel,
        paidOn: settled.paidOn,
      } satisfies IncomeRow
    })

    return { rows, error: null }
  } catch {
    return { rows: [], error: "Could not load income." }
  }
}
