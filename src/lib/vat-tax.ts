import { fetchAllPages } from "@/lib/fetch-pages"
import { createClient } from "@/lib/supabase/server"
import type { BankAccountChoice } from "@/lib/bank-account"

export type VatTaxRow = {
  id: string
  projectId: string
  projectName: string
  paidOn: string
  amount: number
  paymentMethod: string
  notes: string
  bankAccountId: string
  collectedOnInvoice: boolean
}

export type ProjectOption = {
  id: string
  name: string
}

export async function getVatTaxPayments(): Promise<{
  payments: VatTaxRow[]
  projects: ProjectOption[]
  bankAccounts: BankAccountChoice[]
  paymentMethods: string[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [vatRows, projectRows, bankRows, pmRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vat_tax_by_project")
            .select("*")
            .order("paid_on", { ascending: false })
            .range(from, to),
        "VAT tax list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name")
            .order("name", { ascending: true })
            .range(from, to),
        "Projects list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("bank_accounts")
            .select("id, name, is_active")
            .order("sort_order", { ascending: true })
            .range(from, to),
        "Bank accounts list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payment_methods")
            .select("name")
            .order("sort_order", { ascending: true })
            .range(from, to),
        "Payment methods list is larger than expected.",
      ),
    ])

    const rawVat = await fetchAllPages(
      (from, to) =>
        supabase
          .from("vat_tax_payments")
          .select("id, bank_account_id, collected_on_invoice")
          .order("id", { ascending: true })
          .range(from, to),
      "VAT tax list is larger than expected.",
    )

    const bankMap = new Map(rawVat.map((v) => [v.id, v.bank_account_id ?? ""]))
    const collectedMap = new Map(
      rawVat.map((v) => [v.id, v.collected_on_invoice === true]),
    )

    const payments: VatTaxRow[] = vatRows.map((r) => ({
      id: r.vat_tax_id ?? "",
      projectId: r.project_id ?? "",
      projectName: r.project_name ?? "",
      paidOn: r.paid_on ?? "",
      amount: r.vat_tax_paid ?? 0,
      paymentMethod: r.payment_method ?? "",
      notes: r.notes ?? "",
      bankAccountId: bankMap.get(r.vat_tax_id ?? "") ?? "",
      collectedOnInvoice: collectedMap.get(r.vat_tax_id ?? "") ?? false,
    }))

    const projects: ProjectOption[] = projectRows.map((p) => ({
      id: p.id,
      name: p.name,
    }))

    const bankAccounts: BankAccountChoice[] = bankRows.map((b) => ({
      id: b.id,
      name: b.name,
      isActive: b.is_active,
    }))

    const paymentMethods = pmRows.map((pm) => pm.name)

    return { payments, projects, bankAccounts, paymentMethods, error: null }
  } catch {
    return {
      payments: [],
      projects: [],
      bankAccounts: [],
      paymentMethods: [],
      error: "Could not load VAT/tax payments.",
    }
  }
}
