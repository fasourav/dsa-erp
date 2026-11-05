import type { BankAccountChoice } from "@/lib/bank-account"
import { listBankAccounts } from "@/lib/bank-accounts"
import { fetchAllPages, fetchByIds, fetchPage } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import type {
  NamedOption,
  OperationalExpenseRow,
} from "@/lib/operational-expenses"
import { LIST_PAGE_SIZE, sanitizeSearch } from "@/lib/page-query"
import { dateInputValue } from "@/lib/project-validation"
import { creatorNames } from "@/lib/record-audit"
import {
  isReportGroup,
  keywordReportGroup,
  type OfficeCategoryGroup,
} from "@/lib/report-cost-group"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"

type Embedded<T> = T | T[] | null

export async function getOperationalExpenses(
  options: { q?: string; page?: number } = {},
): Promise<{
  expenses: OperationalExpenseRow[]
  categories: OfficeCategoryGroup[]
  departments: NamedOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  total: number
  page: number
  pageCount: number
  error: string | null
}> {
  const empty = {
    expenses: [] as OperationalExpenseRow[],
    categories: [] as OfficeCategoryGroup[],
    departments: [] as NamedOption[],
    paymentMethods: [] as string[],
    bankAccounts: [] as BankAccountChoice[],
    total: 0,
    page: 1,
    pageCount: 1,
    error: "Could not load operational expenses.",
  }
  const supabase = await createClient()
  const requestedPage = options.page ?? 1
  const term = sanitizeSearch(options.q ?? "")

  try {
    const [expenseSlice, categoryRows, departmentRows, methodRows, bankAccounts] =
      await Promise.all([
        fetchPage(
          (from, to) => {
            let query = supabase
              .from("operational_expenses")
              .select(
                "id, expense_date, category, amount, payment_method, department_id, vendor_id, notes, bank_account_id, created_at, created_by, departments(name), vendors(person_name, company_name)",
                { count: "exact" },
              )

            if (term) {
              const like = `%${term}%`
              query = query.or(
                `category.ilike.${like},notes.ilike.${like},payment_method.ilike.${like}`,
              )
            }

            return query
              .order("expense_date", { ascending: false })
              .order("id", { ascending: false })
              .range(from, to)
          },
          requestedPage,
          LIST_PAGE_SIZE,
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("office_expense_categories")
              .select("id, name, sort_order, report_group")
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Office expense category list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("departments")
              .select("id, name, is_active")
              .eq("is_active", true)
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Department list is larger than expected.",
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
        listBankAccounts(),
      ])

    const categories = officeCategoryChoices(categoryRows)
    const officeCategoryNames = new Map(
      categoryRows.flatMap((row) => {
        const name = row.name?.trim() ?? ""
        return name ? [[row.id, name] as const] : []
      }),
    )
    const purchaseOrderPayments = await operationalPurchaseOrderPayments(
      supabase,
      officeCategoryNames,
    )
    const matchingPoPayments = term
      ? purchaseOrderPayments.filter((row) => {
          const haystack = `${row.category} ${row.vendorName} ${row.paymentMethod} ${row.notes}`.toLowerCase()
          return haystack.includes(term.toLowerCase())
        })
      : purchaseOrderPayments

    const departments = departmentRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() ?? "",
    }))
    const creators = await creatorNames(
      supabase,
      "operational_expenses",
      expenseSlice.rows.map((row) => ({ id: row.id, createdBy: row.created_by })),
    )

    const expenses = expenseSlice.rows.map((row) => {
      const department = one(row.departments)
      const vendor = one(row.vendors)

      return {
        id: row.id,
        expenseDate: dateInputValue(row.expense_date),
        category: row.category?.trim() ?? "",
        amount: toNumber(row.amount),
        paymentMethod: row.payment_method?.trim() ?? "",
        departmentId: row.department_id ?? "",
        departmentName: department?.name?.trim() ?? "",
        vendorId: row.vendor_id ?? "",
        vendorName: vendor
          ? partyName(vendor.person_name, vendor.company_name)
          : "",
        notes: row.notes ?? "",
        bankAccountId: row.bank_account_id,
        createdByName: creators.get(row.id) ?? "Unknown",
        createdAt: row.created_at,
        fromPurchaseOrder: false,
        purchaseOrderId: "",
      }
    })

    const pageExpenses =
      expenseSlice.page === 1
        ? [...expenses, ...matchingPoPayments]
        : expenses

    return {
      expenses: pageExpenses,
      categories,
      departments,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        expenses.map((expense) => expense.paymentMethod),
      ),
      bankAccounts,
      total: expenseSlice.total + matchingPoPayments.length,
      page: expenseSlice.page,
      pageCount: expenseSlice.pageCount,
      error: null,
    }
  } catch {
    return empty
  }
}

async function operationalPurchaseOrderPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  officeCategoryNames: Map<string, string>,
): Promise<OperationalExpenseRow[]> {
  const orders = await fetchAllPages(
    (from, to) =>
      supabase
        .from("vendor_purchase_orders")
        .select("id, vendor_id, work_type, office_expense_category_id")
        .is("project_id", null)
        .order("id", { ascending: true })
        .range(from, to),
    "Operational purchase order list is larger than expected.",
  )
  if (orders.length === 0) return []

  const orderById = new Map(orders.map((order) => [order.id, order]))
  const invoices = await fetchChunks(orders.map((order) => order.id), (ids, from, to) =>
    supabase
      .from("vendor_invoices")
      .select("id, purchase_order_id")
      .in("purchase_order_id", ids)
      .order("id", { ascending: true })
      .range(from, to),
  )
  if (invoices.length === 0) return []

  const orderIdByInvoice = new Map(
    invoices.flatMap((invoice) =>
      invoice.purchase_order_id
        ? [[invoice.id, invoice.purchase_order_id] as const]
        : [],
    ),
  )
  const payments = await fetchChunks(
    invoices.map((invoice) => invoice.id),
    (ids, from, to) =>
      supabase
        .from("vendor_payments")
        .select(
          "id, vendor_invoice_id, paid_on, amount, method, created_at, created_by",
        )
        .in("vendor_invoice_id", ids)
        .order("id", { ascending: true })
        .range(from, to),
  )
  if (payments.length === 0) return []

  const vendorIds = orders.flatMap((order) =>
    order.vendor_id ? [order.vendor_id] : [],
  )
  const [vendors, creators] = await Promise.all([
    fetchByIds(vendorIds, (ids) =>
      supabase.from("vendors").select("id, company_name, person_name").in("id", ids),
    ),
    creatorNames(
      supabase,
      "vendor_payments",
      payments.map((payment) => ({ id: payment.id, createdBy: payment.created_by })),
    ),
  ])
  const vendorNames = new Map(
    vendors.map((vendor) => [
      vendor.id,
      vendorDisplayName(vendor.company_name, vendor.person_name),
    ]),
  )

  return payments.flatMap((payment) => {
    const orderId = orderIdByInvoice.get(payment.vendor_invoice_id)
    const order = orderId ? orderById.get(orderId) : undefined
    if (!order || !orderId) return []

    const officeName = order.office_expense_category_id
      ? officeCategoryNames.get(order.office_expense_category_id) ?? ""
      : ""
    const workType = order.work_type?.trim() ?? ""

    return [
      {
        id: payment.id,
        expenseDate: dateInputValue(payment.paid_on),
        category: officeName || workType || "Operational",
        amount: toNumber(payment.amount),
        paymentMethod: payment.method?.trim() ?? "",
        departmentId: "",
        departmentName: "",
        vendorId: order.vendor_id,
        vendorName: vendorNames.get(order.vendor_id) ?? "",
        notes: "From Operational PO",
        bankAccountId: "",
        createdByName: creators.get(payment.id) ?? "Unknown",
        createdAt: payment.created_at,
        fromPurchaseOrder: true,
        purchaseOrderId: orderId,
      } satisfies OperationalExpenseRow,
    ]
  })
}

async function fetchChunks<T>(
  ids: readonly string[],
  load: (
    ids: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))]
  const rows: T[] = []

  for (let index = 0; index < unique.length; index += 100) {
    const slice = unique.slice(index, index + 100)
    const page = await fetchAllPages(
      (from, to) => load(slice, from, to),
      "Operational purchase order list is larger than expected.",
    )
    rows.push(...page)
  }

  return rows
}

function vendorDisplayName(
  companyName: string | null,
  personName: string | null,
): string {
  const company = companyName?.trim() ?? ""
  if (company) return company
  return personName?.trim() ?? ""
}

function officeCategoryChoices(
  rows: { id: string; name: string | null; report_group: string }[],
): OfficeCategoryGroup[] {
  const choices: OfficeCategoryGroup[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const name = row.name?.trim() ?? ""
    if (!name || seen.has(name)) continue
    seen.add(name)
    choices.push({
      id: row.id,
      name,
      reportGroup: isReportGroup(row.report_group)
        ? row.report_group
        : keywordReportGroup(name),
    })
  }

  return choices
}

function partyName(
  personName: string | null,
  companyName: string | null,
): string {
  return (personName ?? companyName ?? "").trim()
}

function one<T>(value: Embedded<T>): T | null {
  if (!value) {
    return null
  }

  return Array.isArray(value) ? value[0] ?? null : value
}
