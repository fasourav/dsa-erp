import type { BankAccountChoice } from "@/lib/bank-account"
import { listBankAccounts } from "@/lib/bank-accounts"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import type {
  NamedOption,
  OperationalExpenseRow,
} from "@/lib/operational-expenses"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"

type Embedded<T> = T | T[] | null

export async function getOperationalExpenses(): Promise<{
  expenses: OperationalExpenseRow[]
  categories: string[]
  departments: NamedOption[]
  vendors: NamedOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  error: string | null
}> {
  const empty = {
    expenses: [] as OperationalExpenseRow[],
    categories: [] as string[],
    departments: [] as NamedOption[],
    vendors: [] as NamedOption[],
    paymentMethods: [] as string[],
    bankAccounts: [] as BankAccountChoice[],
    error: "Could not load operational expenses.",
  }
  const supabase = await createClient()

  try {
    const [expenseRows, categoryRows, departmentRows, vendorRows, methodRows, bankAccounts] =
      await Promise.all([
        fetchAllPages(
          (from, to) =>
            supabase
              .from("operational_expenses")
              .select(
                "id, expense_date, category, amount, payment_method, department_id, vendor_id, notes, bank_account_id, departments(name), vendors(person_name, company_name)",
              )
              .order("id", { ascending: true })
              .range(from, to),
          "Operational expense list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("office_expense_categories")
              .select("name, sort_order")
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
              .from("vendors")
              .select("id, person_name, company_name")
              .order("id", { ascending: true })
              .range(from, to),
          "Vendor list is larger than expected.",
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

    const categories = uniqueNames(categoryRows.map((row) => row.name))
    const departments = departmentRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() ?? "",
    }))
    const vendors = vendorRows
      .map((row) => ({
        id: row.id,
        name: partyName(row.person_name, row.company_name),
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
      )

    const expenses = expenseRows.map((row) => {
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
      }
    })

    return {
      expenses,
      categories,
      departments,
      vendors,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        expenses.map((expense) => expense.paymentMethod),
      ),
      bankAccounts,
      error: null,
    }
  } catch {
    return empty
  }
}

function uniqueNames(values: readonly (string | null)[]): string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const name = value?.trim() ?? ""
    if (!name || seen.has(name)) {
      continue
    }

    seen.add(name)
    names.push(name)
  }

  return names
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
