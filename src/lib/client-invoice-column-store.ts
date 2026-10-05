import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultClientInvoiceColumns,
  sanitizeClientInvoiceColumns,
  type ClientInvoiceColumnVisibility,
} from "@/lib/client-invoice-summary"

export const clientInvoiceColumnStore =
  createColumnStore<ClientInvoiceColumnVisibility>(
    "dsa-erp.client-invoices.columns",
    defaultClientInvoiceColumns(),
    sanitizeClientInvoiceColumns,
  )
