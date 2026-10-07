import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultPoExpenseColumns,
  sanitizePoExpenseColumns,
  type PoExpenseColumnVisibility,
} from "@/lib/po-expenses"

export const poExpenseColumnStore = createColumnStore<PoExpenseColumnVisibility>(
  "dsa-erp.po-expenses.columns",
  defaultPoExpenseColumns(),
  sanitizePoExpenseColumns,
)
