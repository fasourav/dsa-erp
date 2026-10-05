import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultReceivableColumns,
  sanitizeReceivableColumns,
  type ReceivableColumnVisibility,
} from "@/lib/accounts-receivable"

export const receivableColumnStore = createColumnStore<ReceivableColumnVisibility>(
  "dsa-erp.accounts-receivable.columns",
  defaultReceivableColumns(),
  sanitizeReceivableColumns,
)
