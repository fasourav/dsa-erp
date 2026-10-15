import { zipSync, strToU8 } from "fflate"

import { fetchAllPages } from "@/lib/fetch-pages"
import { reportCompanyName } from "@/lib/reports/catalog"
import { guardSheetText, loadExcel } from "@/lib/reports/workbook"
import { createClient } from "@/lib/supabase/server"

type BackupTable = {
  name: string
  // Read from this relation instead when the base table has column-level revokes.
  source?: string
  sheet: string
  order: string[]
}

const tables: BackupTable[] = [
  { name: "company_settings", sheet: "company_settings", order: ["id"] },
  { name: "profiles", sheet: "profiles", order: ["id"] },
  { name: "user_permissions", sheet: "user_permissions", order: ["user_id", "module"] },
  { name: "user_invites", sheet: "user_invites", order: ["email"] },
  { name: "role_templates", sheet: "role_templates", order: ["id"] },
  { name: "role_template_permissions", sheet: "role_template_permissions", order: ["template_id", "module"] },
  { name: "permission_modules", sheet: "permission_modules", order: ["key"] },
  { name: "clients", sheet: "clients", order: ["id"] },
  { name: "leads", sheet: "leads", order: ["id"] },
  { name: "lead_sources", sheet: "lead_sources", order: ["id"] },
  { name: "lead_stages", sheet: "lead_stages", order: ["id"] },
  { name: "lead_statuses", sheet: "lead_statuses", order: ["id"] },
  { name: "lead_types", sheet: "lead_types", order: ["id"] },
  { name: "projects", sheet: "projects", order: ["id"] },
  { name: "project_budget_lines", sheet: "project_budget_lines", order: ["id"] },
  { name: "project_types", sheet: "project_types", order: ["id"] },
  { name: "project_phases", sheet: "project_phases", order: ["id"] },
  { name: "project_expense_categories", sheet: "project_expense_categories", order: ["id"] },
  { name: "vendors", sheet: "vendors", order: ["id"] },
  { name: "vendor_work_categories", sheet: "vendor_work_categories", order: ["id"] },
  { name: "vendor_purchase_orders", sheet: "vendor_purchase_orders", order: ["id"] },
  { name: "vendor_invoices", sheet: "vendor_invoices", order: ["id"] },
  { name: "vendor_payments", sheet: "vendor_payments", order: ["id"] },
  { name: "client_invoices", sheet: "client_invoices", order: ["id"] },
  { name: "client_payments", sheet: "client_payments", order: ["id"] },
  { name: "operational_expenses", sheet: "operational_expenses", order: ["id"] },
  { name: "office_expense_categories", sheet: "office_expense_categories", order: ["id"] },
  { name: "vat_tax_payments", sheet: "vat_tax_payments", order: ["id"] },
  { name: "payment_methods", sheet: "payment_methods", order: ["id"] },
  { name: "bank_accounts", source: "bank_accounts_readable", sheet: "bank_accounts", order: ["id"] },
  { name: "bank_transactions", source: "bank_transactions_readable", sheet: "bank_transactions", order: ["id"] },
  { name: "bank_transfers", sheet: "bank_transfers", order: ["id"] },
  { name: "budgets", sheet: "budgets", order: ["id"] },
  { name: "departments", sheet: "departments", order: ["id"] },
  { name: "assets", sheet: "assets", order: ["id"] },
  { name: "asset_categories", sheet: "asset_categories", order: ["id"] },
  { name: "employees", source: "employees_readable", sheet: "employees", order: ["id"] },
  { name: "payroll_runs", sheet: "payroll_runs", order: ["id"] },
  { name: "payroll_lines", sheet: "payroll_lines", order: ["id"] },
  { name: "quotations", sheet: "quotations", order: ["id"] },
  { name: "quotation_lines", sheet: "quotation_lines", order: ["id"] },
  { name: "quotation_milestones", sheet: "quotation_milestones", order: ["id"] },
  { name: "work_orders", sheet: "work_orders", order: ["id"] },
  { name: "work_order_lines", sheet: "work_order_lines", order: ["id"] },
  { name: "work_order_milestones", sheet: "work_order_milestones", order: ["id"] },
  { name: "issued_documents", sheet: "issued_documents", order: ["id"] },
  { name: "activity_log", sheet: "activity_log", order: ["created_at", "id"] },
]

type Query = {
  select: (columns: string) => Query
  order: (column: string, options?: { ascending?: boolean }) => Query
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }>
}

export type BackupResult =
  | { status: "ok"; bytes: Uint8Array; filename: string; contentType: string }
  | { status: "missing" }
  | { status: "error" }

export async function buildBackup(kind: "excel" | "json"): Promise<BackupResult> {
  const supabase = await createClient()
  const loose = supabase as unknown as { from: (table: string) => Query }
  const loaded: Array<{ table: BackupTable; rows: Record<string, unknown>[] }> = []

  for (const table of tables) {
    try {
      const rows = await fetchAllPages((from, to) => {
        let query = loose.from(table.source ?? table.name).select("*")
        for (const column of table.order) {
          query = query.order(column, { ascending: true })
        }
        return query.range(from, to)
      }, `${table.name} is larger than a single backup can hold.`)
      loaded.push({ table, rows })
    } catch (error) {
      if (isMissingTable(error)) continue
      return { status: "error" }
    }
  }

  const bytes = kind === "excel" ? await workbook(loaded) : jsonZip(loaded)
  const recorded = await supabase.rpc("record_backup", { p_kind: kind })
  if (recorded.error) {
    if (/could not find the function|PGRST202/i.test(recorded.error.message ?? "") || recorded.error.code === "PGRST202") {
      return { status: "missing" }
    }
    return { status: "error" }
  }

  return {
    status: "ok",
    bytes,
    filename: kind === "excel" ? "dsa-erp-backup.xlsx" : "dsa-erp-backup.zip",
    contentType:
      kind === "excel"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/zip",
  }
}

async function workbook(
  loaded: Array<{ table: BackupTable; rows: Record<string, unknown>[] }>,
): Promise<Uint8Array> {
  const ExcelJS = await loadExcel()
  const book = new ExcelJS.Workbook()
  book.creator = reportCompanyName

  for (const entry of loaded) {
    const headers = headersFor(entry.rows)
    const sheet = book.addWorksheet(entry.table.sheet.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    })
    sheet.addRow(headers.length > 0 ? headers : ["empty"])
    sheet.getRow(1).font = { bold: true }
    for (const row of entry.rows) {
      sheet.addRow(headers.map((header) => cellValue(row[header])))
    }
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(36, Math.max(12, (headers[index]?.length ?? 8) + 2))
    })
  }

  if (book.worksheets.length === 0) {
    book.addWorksheet("backup")
  }

  const buffer = await book.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

function jsonZip(
  loaded: Array<{ table: BackupTable; rows: Record<string, unknown>[] }>,
): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  for (const entry of loaded) {
    files[`${entry.table.name}.json`] = strToU8(JSON.stringify(entry.rows))
  }
  if (Object.keys(files).length === 0) {
    files["backup.json"] = strToU8("[]")
  }
  return zipSync(files)
}

function headersFor(rows: Record<string, unknown>[]): string[] {
  const names = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) names.add(key)
  }
  return [...names]
}

function cellValue(value: unknown): string | number | boolean | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "boolean") return value
  if (typeof value === "string") return guardSheetText(value)
  return guardSheetText(JSON.stringify(value))
}

function isMissingTable(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : ""
  return /schema cache|does not exist|could not find the table/i.test(message)
}
