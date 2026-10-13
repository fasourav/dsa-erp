import { isUuid } from "@/lib/ids"

export type SearchHit = {
  moduleKey: string
  moduleLabel: string
  recordId: string
  label: string
  detail: string
  href: string
}

export function firstParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.trim() ?? ""
}

export function searchHref(moduleKey: string, recordId: string, label: string): string {
  const query = encodeURIComponent(label)
  const id = isUuid(recordId) ? recordId : ""

  switch (moduleKey) {
    case "projects":
      return id ? `/projects/${id}` : `/projects?q=${query}`
    case "purchase_orders":
    case "vendor_invoices":
      return id ? `/purchase-orders/${id}` : `/purchase-orders?q=${query}`
    case "clients":
      return `/clients?q=${query}`
    case "leads":
      return `/leads?q=${query}`
    case "vendors":
      return `/vendors?q=${query}`
    case "employees":
      return `/hr/employees?q=${query}`
    case "client_invoices":
      return `/accounts/invoices?q=${query}`
    case "assets":
      return `/assets?q=${query}`
    case "banking":
      return id
        ? `/accounts/bank?account=${encodeURIComponent(id)}&q=${query}`
        : `/accounts/bank?q=${query}`
    default:
      return "/dashboard"
  }
}
