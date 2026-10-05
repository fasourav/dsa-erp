import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultExpenseColumns,
  sanitizeExpenseColumns,
  type ExpenseColumnVisibility,
} from "@/lib/operational-expenses"

export const expenseColumnStore = createColumnStore<ExpenseColumnVisibility>(
  "dsa-erp.operational-expenses.columns",
  defaultExpenseColumns(),
  sanitizeExpenseColumns,
)
