import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultPayableColumns,
  sanitizePayableColumns,
  type PayableColumnVisibility,
} from "@/lib/accounts-payable"

export const payableColumnStore = createColumnStore<PayableColumnVisibility>(
  "dsa-erp.accounts-payable.columns",
  defaultPayableColumns(),
  sanitizePayableColumns,
)
