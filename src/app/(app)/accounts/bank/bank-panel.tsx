"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useAccess, useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteBankTransaction } from "@/app/(app)/accounts/bank/actions"
import { ManualEntriesDialog } from "@/app/(app)/accounts/bank/manual-entries-dialog"
import { BankReconcileView } from "@/app/(app)/accounts/bank/bank-reconcile-view"
import { BankStatementView } from "@/app/(app)/accounts/bank/bank-statement-view"
import {
  BankMovementDialog,
  BankTransferDialog,
} from "@/app/(app)/accounts/bank/bank-transaction-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader, SectionHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
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
  compareLedgerOrder,
  sortBankTransactions,
  type AccountFilter,
  type BankAccountRow,
  type BankTransactionColumnId,
  type BankTransactionRow,
} from "@/lib/bank"
import { bankTransactionColumnStore } from "@/lib/bank-column-store"
import { formatDayMonYear, formatIsoDate } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import type { ReconciliationBundle } from "@/lib/bank-reconcile"
import { cn } from "@/lib/utils"

function signedFlow(direction: BankTransactionRow["direction"], amount: number) {
  const magnitude = Math.abs(amount)
  return direction === "outflow" ? -magnitude : magnitude
}

export function BankPanel({
  accounts,
  transactions,
  paymentMethods,
  accountFilter,
  error,
  fiscalYearStartMonth,
  view,
  initialQuery = "",
  reconciliation = null,
  periodFrom,
  periodTo,
}: {
  accounts: BankAccountRow[]
  transactions: BankTransactionRow[]
  paymentMethods: string[]
  accountFilter: AccountFilter | null
  error: string | null
  fiscalYearStartMonth: number
  view: "ledger" | "statement" | "reconcile"
  initialQuery?: string
  reconciliation?: ReconciliationBundle | null
  periodFrom: string
  periodTo: string
}) {
  const showFinancials = useAccess().showFinancials
  const canAdd = useCan("banking", "add")
  const canEdit = useCan("banking", "edit")
  const canDelete = useCan("banking", "delete")

  const visibility = useColumnVisibility(bankTransactionColumnStore)
  const [sort, setSort] = useState<SortState<BankTransactionColumnId>>({
    key: "transactionDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState(initialQuery)
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
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)
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
    const latest = [...rows].sort(compareLedgerOrder).at(-1)
    return {
      id: account.id,
      name: account.name,
      balance: latest?.balance ?? account.openingBalance,
    }
  })

  const reconcileAccount = accountFilter
    ? accounts.find((row) => row.id === accountFilter.id) ?? null
    : null

  if (view === "statement") {
    return (
      <div className="flex flex-col gap-3.5">
        <PageHeader
          title="Bank"
          description="Statement"
          className="mb-0 md:mb-2"
          actions={
            showFinancials ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    href={
                      accountFilter
                        ? `/accounts/bank?view=reconcile&account=${accountFilter.id}`
                        : "/accounts/bank?view=reconcile"
                    }
                  />
                }
              >
                Reconcile
              </Button>
            ) : null
          }
        />
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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Bank"
        description="Transactions Log"
        className="mb-0 md:mb-2"
        actions={
          <ListExport
            grid={{
              filename: "bank-transactions",
              title: "Bank Transactions",
              columns: [
                { header: "Date", kind: "text" },
                { header: "Account", kind: "text" },
                { header: "Direction", kind: "text" },
                { header: "Source", kind: "text" },
                { header: "Amount", kind: "money" },
                { header: "Balance", kind: "money" },
              ],
              rows: filtered.map((transaction) => [
                formatDayMonYear(transaction.transactionDate),
                transaction.accountName,
                bankFlowLabel(transaction.direction),
                bankSourceLabel(transaction.sourceKind),
                showFinancials ? transaction.amount : "Hidden",
                showFinancials ? transaction.balance : "Hidden",
              ]),
            }}
          />
        }
      />
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
              className="w-full md:w-fit"
              nativeButton={false}
              render={<Link href="/settings" />}
            >
              Open Settings
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          {balances.map((account) => (
            <Card key={account.id} size="sm">
              <CardContent className="flex flex-col gap-1">
                <p className="truncate text-ui font-semibold">{account.name || "Account"}</p>
                <p className="text-label text-muted-foreground">Balance</p>
                <p className="text-metric">
                  {showFinancials ? (
                    <Money value={account.balance} />
                  ) : (
                    <span className="text-muted-foreground">Hidden</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <SectionHeader title="Transactions" />
      {accountFilter ? (
        <p className="px-1 text-sm text-muted-foreground md:px-0">
          For {accountFilter.name || "this account"}.{" "}
          <Link
            href="/accounts/bank"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Show All
          </Link>
        </p>
      ) : null}
      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search transactions"
      />
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
          mobileItem={(transaction) => ({
            title: bankSourceLabel(transaction.sourceKind),
            value: <StatusBadge status={transaction.direction} />,
            subtitle: [
              transaction.accountName,
              transaction.transactionDate ? formatIsoDate(transaction.transactionDate) : null,
            ]
              .filter(Boolean)
              .join(" · "),
            meta: showFinancials ? (
              <Money
                value={signedFlow(transaction.direction, transaction.amount)}
                className={transaction.direction === "outflow" ? "text-destructive" : "text-success"}
              />
            ) : (
              "Hidden"
            ),
          })}
          toolbar={
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <Button
                variant="outline"
                nativeButton={false}
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
              {showFinancials ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={
                    <Link
                      href={
                        accountFilter
                          ? `/accounts/bank?view=reconcile&account=${accountFilter.id}`
                          : "/accounts/bank?view=reconcile"
                      }
                    />
                  }
                >
                  Reconcile
                </Button>
              ) : null}
              {canAdd ? (
                <Button type="button" variant="outline" onClick={() => setManualOpen(true)}>
                  Deposits & Withdrawals
                </Button>
              ) : null}
              {canAdd ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={accounts.length < 2}
                  onClick={() => setTransferOpen(true)}
                >
                  Transfer
                </Button>
              ) : null}
              {canAdd ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={accounts.length === 0}
                  onClick={() => openMovement("withdrawal", null)}
                >
                  Withdrawal
                </Button>
              ) : null}
              {canAdd ? (
                <Button
                  type="button"
                  disabled={accounts.length === 0}
                  onClick={() => openMovement("deposit", null)}
                >
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  Deposit
                </Button>
              ) : null}
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
                      ? "From Monthly Salary"
                      : "From A Payment Or Expense"}
                  </DropdownMenuItem>
                ) : transaction.transferId ? (
                  canDelete ? (
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
                  ) : null
                ) : (
                  <>
                    {canEdit ? (<DropdownMenuItem
                      onClick={() =>
                        openMovement(
                          transaction.direction === "outflow" ? "withdrawal" : "deposit",
                          transaction,
                        )
                      }
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </DropdownMenuItem>) : null}
                    <DropdownMenuSeparator />
                    {canDelete ? (<DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setDeleteError(null)
                        setPendingDelete(transaction)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>) : null}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
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
        itemName={pendingDelete?.projectName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
      {view === "reconcile" ? (
        <BankReconcileView
          accounts={accounts}
          account={reconcileAccount}
          transactions={transactions}
          reconciliation={reconciliation}
          periodFrom={periodFrom}
          periodTo={periodTo}
          showFinancials={showFinancials}
        />
      ) : null}
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
  const showFinancials = useAccess().showFinancials
  switch (columnId) {
    case "transactionDate":
      return transaction.transactionDate ? (
        <span>{formatIsoDate(transaction.transactionDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "accountName":
      return (
        <span className={cn("text-ui font-semibold", !transaction.accountName && "text-muted-foreground")}>
          {transaction.accountName || "—"}
        </span>
      )
    case "direction":
      return <StatusBadge status={transaction.direction} />
    case "sourceKind":
      return <Badge variant="outline">{bankSourceLabel(transaction.sourceKind)}</Badge>
    case "amount":
      return showFinancials ? (
        <Money
          value={signedFlow(transaction.direction, transaction.amount)}
          className={transaction.direction === "outflow" ? "text-destructive" : "text-success"}
        />
      ) : (
        <span className="text-muted-foreground">Hidden</span>
      )
    case "balance":
      return showFinancials ? (
        <Money value={transaction.balance} />
      ) : (
        <span className="text-muted-foreground">Hidden</span>
      )
  }
}
