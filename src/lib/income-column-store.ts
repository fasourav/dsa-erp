import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultIncomeColumns,
  sanitizeIncomeColumns,
  type IncomeColumnVisibility,
} from "@/lib/income"

export const incomeColumnStore = createColumnStore<IncomeColumnVisibility>(
  "dsa-erp.income.columns",
  defaultIncomeColumns(),
  sanitizeIncomeColumns,
)
