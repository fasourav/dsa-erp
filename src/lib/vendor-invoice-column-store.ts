import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultVendorInvoiceColumns,
  sanitizeVendorInvoiceColumns,
  type VendorInvoiceColumnVisibility,
} from "@/lib/vendor-invoice-summary"

export const vendorInvoiceColumnStore =
  createColumnStore<VendorInvoiceColumnVisibility>(
    "dsa-erp.vendor-invoices.columns",
    defaultVendorInvoiceColumns(),
    sanitizeVendorInvoiceColumns,
  )
