"use server"

import type { ListExportLoaderResult } from "@/components/list-export"
import {
  bankFlowLabel,
  bankSourceLabel,
  defaultBankTransactionSort,
  sortableBankTransactionColumns,
  type BankTransactionColumnId,
} from "@/lib/bank"
import { getAllBankTransactionsForExport } from "@/lib/bank-data"
import {
  defaultClientInvoiceSort,
  sortableClientInvoiceColumns,
  type ClientInvoiceColumnId,
} from "@/lib/client-invoice-summary"
import { getAllClientInvoicesForExport } from "@/lib/client-invoices"
import { formatDayMonYear } from "@/lib/format"
import type { SortDirection } from "@/lib/list-paging"
import {
  defaultExpenseSort,
  sortableExpenseColumns,
  sortExpenses,
  type ExpenseColumnId,
} from "@/lib/operational-expenses"
import { getAllOperationalExpensesForExport } from "@/lib/operational-expenses-data"
import { parseSortParams } from "@/lib/page-query"
import { paymentStatusLabel } from "@/lib/payment-status"
import { denyUnless, getAccess } from "@/lib/permissions"
import { parseSettlementFilter } from "@/lib/settlement-filter"

export async function exportClientInvoicesGrid(input: {
  projectId: string | null
  q: string
  status: string
  sortKey: ClientInvoiceColumnId
  sortDir: SortDirection
}): Promise<ListExportLoaderResult> {
  const denied = await denyUnless("client_invoices", "view")
  if (denied) return { error: denied }

  const status = parseSettlementFilter(input.status)
  const sort = parseSortParams<ClientInvoiceColumnId>(
    { sort: input.sortKey, dir: input.sortDir },
    sortableClientInvoiceColumns,
    defaultClientInvoiceSort,
  )
  const { invoices, error } = await getAllClientInvoicesForExport(
    input.projectId,
    { q: input.q, status, sort },
  )
  if (error) return { error }

  return {
    grid: {
      filename: "client-invoices",
      title: "Client Invoices",
      columns: [
        { header: "Issue Date", kind: "text" },
        { header: "Project", kind: "text" },
        { header: "Client", kind: "text" },
        { header: "Amount", kind: "money" },
        { header: "Paid", kind: "money" },
        { header: "Status", kind: "text" },
      ],
      rows: invoices.map((invoice) => [
        formatDayMonYear(invoice.issuedOn),
        invoice.projectName,
        invoice.clientName,
        invoice.amount,
        invoice.paid,
        paymentStatusLabel(invoice.status),
      ]),
    },
  }
}

export async function exportBankTransactionsGrid(input: {
  accountId: string | null
  q: string
  sortKey: BankTransactionColumnId
  sortDir: SortDirection
}): Promise<ListExportLoaderResult> {
  const denied = await denyUnless("banking", "view")
  if (denied) return { error: denied }

  const access = await getAccess()
  const showFinancials = Boolean(access?.showFinancials)
  const sort = parseSortParams<BankTransactionColumnId>(
    { sort: input.sortKey, dir: input.sortDir },
    sortableBankTransactionColumns,
    defaultBankTransactionSort,
  )

  const { transactions, error } = await getAllBankTransactionsForExport(
    input.accountId,
    { q: input.q, sort },
  )
  if (error) return { error }

  return {
    grid: {
      filename: "bank-transactions",
      title: "Bank Transactions",
      columns: [
        { header: "Date", kind: "text" },
        { header: "Account", kind: "text" },
        { header: "Direction", kind: "text" },
        { header: "Source", kind: "text" },
        { header: "Amount", kind: "money" },
        { header: "Balance", kind: "money" },
      ],
      rows: transactions.map((transaction) => [
        formatDayMonYear(transaction.transactionDate),
        transaction.accountName,
        bankFlowLabel(transaction.direction),
        bankSourceLabel(transaction.sourceKind, {
          projectId: transaction.projectId,
        }),
        showFinancials ? transaction.amount : "Hidden",
        showFinancials ? transaction.balance : "Hidden",
      ]),
    },
  }
}

export async function exportOperationalExpensesGrid(input: {
  q: string
  sortKey: ExpenseColumnId
  sortDir: SortDirection
}): Promise<ListExportLoaderResult> {
  const denied = await denyUnless("expenses", "view")
  if (denied) return { error: denied }

  const sort = parseSortParams<ExpenseColumnId>(
    { sort: input.sortKey, dir: input.sortDir },
    sortableExpenseColumns,
    defaultExpenseSort,
  )

  const { expenses, error } = await getAllOperationalExpensesForExport({
    q: input.q,
    sort,
  })
  if (error) return { error }

  const sorted = sortExpenses(expenses, sort)

  return {
    grid: {
      filename: "operational-expenses",
      title: "Operational Expenses",
      columns: [
        { header: "Date", kind: "text" },
        { header: "Category", kind: "text" },
        { header: "Project / Office", kind: "text" },
        { header: "Amount", kind: "money" },
        { header: "Payment Method", kind: "text" },
        { header: "Banking Channel", kind: "text" },
        { header: "Department", kind: "text" },
        { header: "Vendor", kind: "text" },
        { header: "Voucher No", kind: "text" },
        { header: "Notes", kind: "text" },
        { header: "Recorded By", kind: "text" },
      ],
      rows: sorted.map((row) => [
        formatDayMonYear(row.expenseDate),
        row.fromPurchaseOrder
          ? `${row.category} · From Operational PO`
          : row.category || "—",
        row.projectName || "Office",
        row.amount,
        row.paymentMethod || "—",
        row.bankAccountName || "—",
        row.departmentName || "—",
        row.vendorName || "—",
        row.voucherNo || "—",
        row.notes || "—",
        row.createdByName || "—",
      ]),
    },
  }
}
