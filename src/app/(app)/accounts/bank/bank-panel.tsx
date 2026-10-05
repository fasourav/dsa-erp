"use client"

import { List, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import {
  deleteBankAccount,
  deleteBankTransaction,
} from "@/app/(app)/accounts/bank/actions"
import { BankAccountFormDialog } from "@/app/(app)/accounts/bank/bank-account-form-dialog"
import { BankTransactionFormDialog } from "@/app/(app)/accounts/bank/bank-transaction-form-dialog"
import { CustomizeColumns, DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  bankAccountColumns,
  bankDirectionLabel,
  bankSourceLabel,
  bankTransactionColumns,
  sortBankAccounts,
  sortBankTransactions,
  type AccountFilter,
  type BankAccountColumnId,
  type BankAccountRow,
  type BankTransactionColumnId,
  type BankTransactionRow,
} from "@/lib/bank"
import {
  bankAccountColumnStore,
  bankTransactionColumnStore,
} from "@/lib/bank-column-store"
import { formatIsoDate, formatMoney } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import type { NamedOption } from "@/lib/operational-expenses"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { cn } from "@/lib/utils"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"
const accountLocked = new Set<BankAccountColumnId>(["name"])
const transactionLocked = new Set<BankTransactionColumnId>([
  "transactionDate",
  "accountName",
])

export function BankPanel({
  accounts,
  transactions,
  projects,
  paymentMethods,
  accountFilter,
  error,
}: {
  accounts: BankAccountRow[]
  transactions: BankTransactionRow[]
  projects: NamedOption[]
  paymentMethods: string[]
  accountFilter: AccountFilter | null
  error: string | null
}) {
  const accountVisibility = useColumnVisibility(bankAccountColumnStore)
  const transactionVisibility = useColumnVisibility(bankTransactionColumnStore)
  const [accountSort, setAccountSort] = useState<SortState<BankAccountColumnId>>({
    key: "name",
    direction: "asc",
  })
  const [transactionSort, setTransactionSort] = useState<
    SortState<BankTransactionColumnId>
  >({ key: "transactionDate", direction: "desc" })
  const [accountPage, setAccountPage] = useState(1)
  const [transactionPage, setTransactionPage] = useState(1)
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [formAccount, setFormAccount] = useState<BankAccountRow | null>(null)
  const [accountFormSession, setAccountFormSession] = useState(0)
  const [transactionFormOpen, setTransactionFormOpen] = useState(false)
  const [formTransaction, setFormTransaction] = useState<BankTransactionRow | null>(
    null,
  )
  const [transactionFormSession, setTransactionFormSession] = useState(0)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [pendingAccount, setPendingAccount] = useState<BankAccountRow | null>(null)
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(null)
  const [deletingAccount, startDeleteAccount] = useTransition()
  const [deleteTransactionOpen, setDeleteTransactionOpen] = useState(false)
  const [pendingTransaction, setPendingTransaction] =
    useState<BankTransactionRow | null>(null)
  const [transactionDeleteError, setTransactionDeleteError] = useState<string | null>(
    null,
  )
  const [deletingTransaction, startDeleteTransaction] = useTransition()

  const sortedAccounts = useMemo(
    () => sortBankAccounts(accounts, accountSort),
    [accounts, accountSort],
  )
  const sortedTransactions = useMemo(
    () => sortBankTransactions(transactions, transactionSort),
    [transactions, transactionSort],
  )
  const accountPageResult = paginateRows(sortedAccounts, accountPage)
  const transactionPageResult = paginateRows(sortedTransactions, transactionPage)
  const accountListError = accounts.length === 0 ? error : null
  const transactionListError = accounts.length === 0 ? null : error

  function openAccountForm(account: BankAccountRow | null) {
    setFormAccount(account)
    setAccountFormSession((current) => current + 1)
    setAccountFormOpen(true)
  }

  function openTransactionForm(transaction: BankTransactionRow | null) {
    setFormTransaction(transaction)
    setTransactionFormSession((current) => current + 1)
    setTransactionFormOpen(true)
  }

  function confirmDeleteAccount() {
    if (!pendingAccount) {
      return
    }

    const id = pendingAccount.id
    startDeleteAccount(async () => {
      try {
        const result = await deleteBankAccount(id)
        if (result.error) {
          setAccountDeleteError(result.error)
          return
        }

        setDeleteAccountOpen(false)
        setAccountDeleteError(null)
      } catch {
        setAccountDeleteError("Could not delete this bank account.")
      }
    })
  }

  function confirmDeleteTransaction() {
    if (!pendingTransaction) {
      return
    }

    const id = pendingTransaction.id
    startDeleteTransaction(async () => {
      try {
        const result = await deleteBankTransaction(id)
        if (result.error) {
          setTransactionDeleteError(result.error)
          return
        }

        setDeleteTransactionOpen(false)
        setTransactionDeleteError(null)
      } catch {
        setTransactionDeleteError("Could not delete this transaction.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Bank</h1>
        <p className="text-sm text-muted-foreground">
          Accounts and the money moving in and out of them.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium tracking-tight">Bank accounts</h2>
        <DataList
          columns={bankAccountColumns}
          rows={accountListError ? [] : accountPageResult.rows}
          rowKey={(account) => account.id}
          sort={accountSort}
          onSort={(key) => {
            setAccountSort((current) => toggleSort(current, key))
            setAccountPage(1)
          }}
          visibility={accountVisibility}
          error={accountListError}
          emptyMessage="No bank accounts yet."
          rangeText={rangeLabel(
            accountPageResult.rangeStart,
            accountPageResult.rangeEnd,
            accountListError ? 0 : accountPageResult.total,
            "account",
            "accounts",
          )}
          currentPage={accountPageResult.currentPage}
          pageCount={accountPageResult.pageCount}
          onPageChange={setAccountPage}
          pagingLabel="Bank accounts pagination"
          toolbar={
            <>
              <CustomizeColumns
                columns={bankAccountColumns}
                visibility={accountVisibility}
                onVisibilityChange={(id, checked) => {
                  if (accountLocked.has(id)) {
                    return
                  }

                  bankAccountColumnStore.write({
                    ...accountVisibility,
                    [id]: checked,
                  })
                }}
              />
              <Button type="button" onClick={() => openAccountForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add account
              </Button>
            </>
          }
          renderCell={(account, columnId) => (
            <AccountCell account={account} columnId={columnId} />
          )}
          renderActions={(account) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${account.name || "bank account"}`}
                  />
                }
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link href={`/accounts/bank?account=${account.id}`} />}
                >
                  <List aria-hidden="true" />
                  Transactions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAccountForm(account)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setAccountDeleteError(null)
                    setPendingAccount(account)
                    setDeleteAccountOpen(true)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-medium tracking-tight">Transactions</h2>
          {accountFilter ? (
            <p className="text-sm text-muted-foreground">
              For {accountFilter.name || "this account"}.{" "}
              <Link
                href="/accounts/bank"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Show all
              </Link>
            </p>
          ) : null}
        </div>
        <DataList
          columns={bankTransactionColumns}
          rows={transactionListError ? [] : transactionPageResult.rows}
          rowKey={(transaction) => transaction.id}
          sort={transactionSort}
          onSort={(key) => {
            setTransactionSort((current) => toggleSort(current, key))
            setTransactionPage(1)
          }}
          visibility={transactionVisibility}
          error={transactionListError}
          emptyMessage={
            accountFilter
              ? "No transactions for this account."
              : "No bank transactions yet."
          }
          rangeText={rangeLabel(
            transactionPageResult.rangeStart,
            transactionPageResult.rangeEnd,
            transactionListError ? 0 : transactionPageResult.total,
            "transaction",
            "transactions",
          )}
          currentPage={transactionPageResult.currentPage}
          pageCount={transactionPageResult.pageCount}
          onPageChange={setTransactionPage}
          pagingLabel="Bank transactions pagination"
          toolbar={
            <>
              <CustomizeColumns
                columns={bankTransactionColumns}
                visibility={transactionVisibility}
                onVisibilityChange={(id, checked) => {
                  if (transactionLocked.has(id)) {
                    return
                  }

                  bankTransactionColumnStore.write({
                    ...transactionVisibility,
                    [id]: checked,
                  })
                }}
              />
              <Button
                type="button"
                disabled={accounts.length === 0}
                onClick={() => openTransactionForm(null)}
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add transaction
              </Button>
            </>
          }
          renderCell={(transaction, columnId) => (
            <TransactionCell transaction={transaction} columnId={columnId} />
          )}
          renderActions={(transaction) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for transaction on ${transaction.transactionDate || "an unknown date"}`}
                  />
                }
              >
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => openTransactionForm(transaction)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setTransactionDeleteError(null)
                    setPendingTransaction(transaction)
                    setDeleteTransactionOpen(true)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </section>

      <BankAccountFormDialog
        key={accountFormSession}
        open={accountFormOpen}
        onOpenChange={setAccountFormOpen}
        account={formAccount}
      />
      <BankTransactionFormDialog
        key={transactionFormSession}
        open={transactionFormOpen}
        onOpenChange={setTransactionFormOpen}
        transaction={formTransaction}
        accounts={accounts}
        projects={projects}
        paymentMethods={paymentMethods}
        defaultAccountId={accountFilter?.id ?? null}
      />
      <DeleteConfirmDialog
        open={deleteAccountOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deletingAccount) {
            return
          }

          setDeleteAccountOpen(false)
          setAccountDeleteError(null)
        }}
        title="Delete bank account"
        error={accountDeleteError}
        pending={deletingAccount}
        confirmKey={pendingAccount?.id}
        onConfirm={confirmDeleteAccount}
      />
      <DeleteConfirmDialog
        open={deleteTransactionOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deletingTransaction) {
            return
          }

          setDeleteTransactionOpen(false)
          setTransactionDeleteError(null)
        }}
        title="Delete bank transaction"
        error={transactionDeleteError}
        pending={deletingTransaction}
        confirmKey={pendingTransaction?.id}
        onConfirm={confirmDeleteTransaction}
      />
    </div>
  )
}

function AccountCell({
  account,
  columnId,
}: {
  account: BankAccountRow
  columnId: BankAccountColumnId
}) {
  switch (columnId) {
    case "name":
      return <span className="font-medium">{account.name || "—"}</span>
    case "bankName":
    case "currency":
      return account[columnId] ? (
        <span>{account[columnId]}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "isActive":
      return (
        <Badge
          variant="secondary"
          className={cn(
            pillClassName,
            account.isActive
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {account.isActive ? "Active" : "Inactive"}
        </Badge>
      )
  }
}

function TransactionCell({
  transaction,
  columnId,
}: {
  transaction: BankTransactionRow
  columnId: BankTransactionColumnId
}) {
  switch (columnId) {
    case "transactionDate":
      return transaction.transactionDate ? (
        <span>{formatIsoDate(transaction.transactionDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "accountName":
    case "projectName":
    case "paymentMethod":
    case "notes":
      return transaction[columnId] ? (
        <span className={columnId === "accountName" ? "font-medium" : undefined}>
          {transaction[columnId]}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "direction":
      return <span>{bankDirectionLabel(transaction.direction)}</span>
    case "sourceKind":
      return <span>{bankSourceLabel(transaction.sourceKind)}</span>
    case "amount":
      return (
        <span className="tabular-nums">{formatMoney(transaction.amount)}</span>
      )
  }
}
