"use client"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteBankTransaction } from "@/app/(app)/accounts/bank/actions"
import { ManualEntriesDialog } from "@/app/(app)/accounts/bank/manual-entries-dialog"
import { BankStatementView } from "@/app/(app)/accounts/bank/bank-statement-view"
import {
  BankMovementDialog,
  BankTransferDialog,
} from "@/app/(app)/accounts/bank/bank-transaction-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  bankFlowLabel,
  bankSourceLabel,
  bankTransactionColumns,
  sortBankTransactions,
  type AccountFilter,
  type BankAccountRow,
  type BankTransactionColumnId,
  type BankTransactionRow,
} from "@/lib/bank"
import { bankTransactionColumnStore } from "@/lib/bank-column-store"
import { formatIsoDate } from "@/lib/format"
import { formatExactBdt } from "@/lib/dashboard-metrics"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { cn } from "@/lib/utils"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function BankPanel({
  accounts,
  transactions,
  paymentMethods,
  accountFilter,
  error,
  fiscalYearStartMonth,
  view,
}: {
  accounts: BankAccountRow[]
  transactions: BankTransactionRow[]
  paymentMethods: string[]
  accountFilter: AccountFilter | null
  error: string | null
  fiscalYearStartMonth: number
  view: "ledger" | "statement"
}) {
  const visibility = useColumnVisibility(bankTransactionColumnStore)
  const [sort, setSort] = useState<SortState<BankTransactionColumnId>>({
    key: "transactionDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [movementOpen, setMovementOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [movementKind, setMovementKind] = useState<"deposit" | "withdrawal">("deposit")
  const [transferOpen, setTransferOpen] = useState(false)
  const [formTransaction, setFormTransaction] = useState<BankTransactionRow | null>(
    null,
  )
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BankTransactionRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const visibleTransactions = accountFilter
    ? transactions.filter((row) => row.bankAccountId === accountFilter.id)
    : transactions
  const sorted = useMemo(
    () => sortBankTransactions(visibleTransactions, sort),
    [visibleTransactions, sort],
  )
  const pageResult = paginateRows(sorted, page)
  const manualEntries = visibleTransactions.filter(
    (row) => row.sourceKind === "deposit" || row.sourceKind === "withdrawal",
  )

  function openMovement(
    kind: "deposit" | "withdrawal",
    transaction: BankTransactionRow | null,
  ) {
    setMovementKind(kind)
    setFormTransaction(transaction)
    setFormSession((current) => current + 1)
    setMovementOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteBankTransaction(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this transaction.")
      }
    })
  }

  const shownAccounts = accountFilter
    ? accounts.filter((account) => account.id === accountFilter.id)
    : accounts
  const balances = shownAccounts.map((account) => {
    const rows = transactions.filter((row) => row.bankAccountId === account.id)
    if (rows.length === 0) {
      return { id: account.id, name: account.name, balance: account.openingBalance }
    }
    const latest = [...rows].sort((left, right) => {
      const byDate = right.transactionDate.localeCompare(left.transactionDate)
      return byDate === 0 ? right.id.localeCompare(left.id) : byDate
    })[0]
    return { id: account.id, name: account.name, balance: latest.balance }
  })

  if (view === "statement") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight">Bank</h1>
          <p className="text-sm text-muted-foreground">Statement</p>
        </div>
        <BankStatementView
          accounts={accounts}
          transactions={transactions}
          fiscalYearStartMonth={fiscalYearStartMonth}
          accountId={accountFilter?.id ?? null}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Bank</h1>
        <p className="text-sm text-muted-foreground">Transactions Log</p>
      </div>
      {accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Add Your First Bank Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Payments, Payroll, And Transfers Need A Bank Account. Add One In Settings.
            </p>
            <Button
              type="button"
              className="w-full sm:w-fit"
              render={<Link href="/settings" />}
            >
              Open Settings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {balances.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle className="text-base">{account.name || "Account"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-2xl font-medium tabular-nums">
                  {formatExactBdt(account.balance)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
                Show All
              </Link>
            </p>
          ) : null}
        </div>
        <DataList
          columns={bankTransactionColumns}
          rows={error ? [] : pageResult.rows}
          rowKey={(transaction) => transaction.id}
          sort={sort}
          onSort={(key) => {
            setSort((current) => toggleSort(current, key))
            setPage(1)
          }}
          visibility={visibility}
          error={error}
          emptyMessage={
            accountFilter
              ? "No Transactions For This Account."
              : "No Bank Transactions Yet."
          }
          rangeText={rangeLabel(
            pageResult.rangeStart,
            pageResult.rangeEnd,
            error ? 0 : pageResult.total,
            "transaction",
            "transactions",
          )}
          currentPage={pageResult.currentPage}
          pageCount={pageResult.pageCount}
          onPageChange={setPage}
          pagingLabel="Bank transactions pagination"
          toolbar={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                render={
                  <Link
                    href={
                      accountFilter
                        ? `/accounts/bank?view=statement&account=${accountFilter.id}`
                        : "/accounts/bank?view=statement"
                    }
                  />
                }
              >
                Statement
              </Button>
              <Button type="button" variant="outline" onClick={() => setManualOpen(true)}>
                Deposits & Withdrawals
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={accounts.length < 2}
                onClick={() => setTransferOpen(true)}
              >
                Transfer
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={accounts.length === 0}
                onClick={() => openMovement("withdrawal", null)}
              >
                Withdrawal
              </Button>
              <Button
                type="button"
                disabled={accounts.length === 0}
                onClick={() => openMovement("deposit", null)}
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
                Deposit
              </Button>
            </div>
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
              <DropdownMenuContent align="end" className="w-56">
                {transaction.linked ? (
                  <DropdownMenuItem disabled>
                    {transaction.sourceKind === "payroll"
                      ? "From Payroll"
                      : "From A Payment Or Expense"}
                  </DropdownMenuItem>
                ) : transaction.transferId ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setDeleteError(null)
                      setPendingDelete(transaction)
                      setDeleteOpen(true)
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete Transfer
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        openMovement(
                          transaction.direction === "outflow" ? "withdrawal" : "deposit",
                          transaction,
                        )
                      }
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteError(null)
                        setPendingDelete(transaction)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </section>
      <ManualEntriesDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        rows={manualEntries}
        onEdit={(transaction) =>
          openMovement(
            transaction.direction === "outflow" ? "withdrawal" : "deposit",
            transaction,
          )
        }
        onDelete={(transaction) => {
          setDeleteError(null)
          setPendingDelete(transaction)
          setDeleteOpen(true)
        }}
      />
      <BankMovementDialog
        key={formSession}
        open={movementOpen}
        onOpenChange={setMovementOpen}
        kind={
          formTransaction
            ? formTransaction.direction === "outflow"
              ? "withdrawal"
              : "deposit"
            : movementKind
        }
        transaction={formTransaction}
        accounts={accounts}
        paymentMethods={paymentMethods}
        defaultAccountId={accountFilter?.id ?? null}
      />
      <BankTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={accounts}
        paymentMethods={paymentMethods}
        defaultAccountId={accountFilter?.id ?? null}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Bank Transaction"
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
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
      return transaction.accountName ? (
        <span className="font-medium">{transaction.accountName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "direction":
      return (
        <Badge
          variant="outline"
          className={cn(
            pillClassName,
            transaction.direction === "inflow"
              ? "border-primary text-primary"
              : "border-destructive text-destructive",
          )}
        >
          {bankFlowLabel(transaction.direction)}
        </Badge>
      )
    case "sourceKind":
      return <span>{bankSourceLabel(transaction.sourceKind)}</span>
    case "amount":
    case "balance":
      return (
        <span className="tabular-nums">{formatExactBdt(transaction[columnId])}</span>
      )
  }
}
