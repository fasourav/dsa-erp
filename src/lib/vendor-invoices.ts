import type { BankAccountChoice } from "@/lib/bank-account"
import { listBankAccounts } from "@/lib/bank-accounts"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { openPayableForBill, sumOpenPayable } from "@/lib/open-payable"
import { dateInputValue } from "@/lib/project-validation"
import {
  derivePaymentStatus,
  isPaymentStatus,
  sumAmounts,
} from "@/lib/payment-status"
import { creatorNames } from "@/lib/record-audit"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"
import type {
  PurchaseOrderDetail,
  VendorInvoiceRow,
  VendorPaymentRow,
} from "@/lib/vendor-invoice-summary"

export async function getVendorInvoicePage(purchaseOrderId: string): Promise<{
  purchaseOrder: PurchaseOrderDetail | null
  invoices: VendorInvoiceRow[]
  paymentMethods: string[]
  expenseCategories: string[]
  bankAccounts: BankAccountChoice[]
  error: string | null
}> {
  const empty = {
    purchaseOrder: null,
    invoices: [] as VendorInvoiceRow[],
    paymentMethods: [] as string[],
    expenseCategories: [] as string[],
    bankAccounts: [] as BankAccountChoice[],
    error: "Could not load vendor payments.",
  }

  if (!isUuid(purchaseOrderId)) {
    return { ...empty, error: "That purchase order could not be found." }
  }

  const supabase = await createClient()

  try {
    const orderResult = await supabase
      .from("vendor_purchase_orders")
      .select(
        "id, issued_on, notes, project_id, vendor_id, work_type, total_value, expense_category_id",
      )
      .eq("id", purchaseOrderId)
      .limit(1)

    if (orderResult.error) {
      return empty
    }

    const order = orderResult.data?.[0]
    if (!order) {
      return { ...empty, error: "That purchase order could not be found." }
    }

    const [projectRows, vendorRows, balanceRows, invoiceRows, methodRows, categoryRows, bankAccounts] =
      await Promise.all([
        order.project_id
          ? supabase.from("projects").select("id, name").eq("id", order.project_id).limit(1)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("vendor_summaries")
          .select("vendor_id, display_name")
          .eq("vendor_id", order.vendor_id)
          .limit(1),
        supabase
          .from("vendor_po_balances")
          .select("purchase_order_id, total_paid")
          .eq("purchase_order_id", order.id)
          .limit(1),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("vendor_invoices")
              .select(
                "id, issued_on, amount, status, description, purchase_order_id",
              )
              .eq("purchase_order_id", order.id)
              .order("id", { ascending: true })
              .range(from, to),
          "Vendor payment list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("payment_methods")
              .select("name, sort_order")
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Payment method list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("project_expense_categories")
              .select("id, name, sort_order")
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Expense category list is larger than expected.",
        ),
        listBankAccounts(),
      ])

    if (projectRows.error || vendorRows.error || balanceRows.error) {
      return empty
    }

    const invoiceIds = invoiceRows.map((row) => row.id)
    const paymentRows =
      invoiceIds.length === 0
        ? []
        : await fetchAllPages(
            (from, to) =>
              supabase
                .from("vendor_payments")
                .select(
                  "id, vendor_invoice_id, paid_on, amount, method, reference, notes, expense_category, bank_account_id, created_at, created_by",
                )
                .in("vendor_invoice_id", invoiceIds)
                .order("id", { ascending: true })
                .range(from, to),
            "Vendor payment list is larger than expected.",
          )

    const accountsById = new Map(bankAccounts.map((account) => [account.id, account.name]))
    const paymentIds = paymentRows.map((row) => row.id)
    const [creators, bankLines] = await Promise.all([
      creatorNames(
        supabase,
        "vendor_payments",
        paymentRows.map((row) => ({ id: row.id, createdBy: row.created_by })),
      ),
      paymentIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("bank_transactions_readable")
            .select("vendor_payment_id, transaction_date, amount, bank_account_id")
            .in("vendor_payment_id", paymentIds),
    ])
    const bankByPayment = new Map<
      string,
      { date: string; amount: number; account: string }
    >()
    if (!bankLines.error) {
      for (const line of bankLines.data ?? []) {
        if (!line.vendor_payment_id || !line.transaction_date) continue
        bankByPayment.set(line.vendor_payment_id, {
          date: dateInputValue(line.transaction_date),
          amount: toNumber(line.amount),
          account: line.bank_account_id
            ? accountsById.get(line.bank_account_id) ?? ""
            : "",
        })
      }
    }
    const paymentsByInvoice = new Map<string, VendorPaymentRow[]>()
    for (const row of paymentRows) {
      const bankLine = bankByPayment.get(row.id)
      const payment: VendorPaymentRow = {
        id: row.id,
        paidOn: dateInputValue(row.paid_on),
        amount: toNumber(row.amount),
        method: row.method?.trim() ?? "",
        reference: row.reference?.trim() ?? "",
        notes: row.notes ?? "",
        expenseCategory: row.expense_category?.trim() ?? "",
        bankAccountId: row.bank_account_id,
        bankAccountName: accountsById.get(row.bank_account_id) ?? "",
        createdByName: creators.get(row.id) ?? "Unknown",
        createdAt: row.created_at,
        purchaseOrderId: order.id,
        purchaseOrderIssuedOn: dateInputValue(order.issued_on),
        billIssuedOn: "",
        billAmount: 0,
        bankLineDate: bankLine?.date ?? "",
        bankLineAmount: bankLine?.amount ?? 0,
        bankLineAccount: bankLine?.account ?? "",
      }
      const current = paymentsByInvoice.get(row.vendor_invoice_id) ?? []
      current.push(payment)
      paymentsByInvoice.set(row.vendor_invoice_id, current)
    }

    const invoices = invoiceRows.flatMap((row) => {
      if (!isPaymentStatus(row.status)) {
        return []
      }

      const payments = (paymentsByInvoice.get(row.id) ?? []).map((payment) => ({
        ...payment,
        billIssuedOn: dateInputValue(row.issued_on),
        billAmount: toNumber(row.amount),
      }))
      const paid = sumAmounts(payments.map((payment) => payment.amount))
      const balance = openPayableForBill(toNumber(row.amount), paid, row.status)

      return [
        {
          id: row.id,
          issuedOn: dateInputValue(row.issued_on),
          amount: toNumber(row.amount),
          status:
            row.status === "void"
              ? "void"
              : derivePaymentStatus(toNumber(row.amount), paid),
          description: row.description ?? "",
          paid,
          balance,
          payments,
        } satisfies VendorInvoiceRow,
      ]
    })

    const balance = balanceRows.data?.[0]
    const purchaseOrder: PurchaseOrderDetail = {
      id: order.id,
      issuedOn: dateInputValue(order.issued_on),
      projectId: order.project_id,
      projectName: projectRows.data?.[0]?.name?.trim() ?? "",
      vendorId: order.vendor_id,
      vendorName: vendorRows.data?.[0]?.display_name?.trim() ?? "",
      workType: order.work_type?.trim() ?? "",
      expenseCategoryName:
        categoryRows.find((row) => row.id === order.expense_category_id)?.name?.trim() ??
        "",
      totalValue: toNumber(order.total_value),
      totalPaid: toNumber(balance?.total_paid),
      totalPending: sumOpenPayable(
        invoices.map((invoice) => ({
          id: invoice.id,
          amount: invoice.amount,
          status: invoice.status,
        })),
        new Map(invoices.map((invoice) => [invoice.id, invoice.paid])),
      ),
      notes: order.notes ?? "",
    }

    return {
      purchaseOrder,
      invoices,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        invoices.flatMap((invoice) =>
          invoice.payments.map((payment) => payment.method),
        ),
      ),
      expenseCategories: mergeCategorySuggestions(
        categoryRows.map((row) => row.name),
        invoices.flatMap((invoice) =>
          invoice.payments.map((payment) => payment.expenseCategory),
        ),
      ),
      bankAccounts,
      error: null,
    }
  } catch {
    return empty
  }
}
