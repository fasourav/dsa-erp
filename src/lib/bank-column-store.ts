import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultBankAccountColumns,
  defaultBankTransactionColumns,
  sanitizeBankAccountColumns,
  sanitizeBankTransactionColumns,
  type BankAccountColumnVisibility,
  type BankTransactionColumnVisibility,
} from "@/lib/bank"

export const bankAccountColumnStore = createColumnStore<BankAccountColumnVisibility>(
  "dsa-erp.bank-accounts.columns",
  defaultBankAccountColumns(),
  sanitizeBankAccountColumns,
)

export const bankTransactionColumnStore =
  createColumnStore<BankTransactionColumnVisibility>(
    "dsa-erp.bank-transactions.columns",
    defaultBankTransactionColumns(),
    sanitizeBankTransactionColumns,
  )
