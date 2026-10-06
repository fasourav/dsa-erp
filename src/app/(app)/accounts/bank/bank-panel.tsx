"use client"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteBankTransaction } from "@/app/(app)/accounts/bank/actions"
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
  const visibility = useColumnVisibility(bankTransactionColumnStore)
  const [sort, setSort] = useState<SortState<BankTransactionColumnId>>({
    key: "transactionDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
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

  const sorted = useMemo(
    () => sortBankTransactions(transactions, sort),
    [transactions, sort],
  )
  const pageResult = paginateRows(sorted, page)

  function changeVisibility(id: BankTransactionColumnId, checked: boolean) {
    if (transactionLocked.has(id)) {
      return
    }

    bankTransactionColumnStore.write({ ...visibility, [id]: checked })
  }

  function openForm(transaction: BankTransactionRow | null) {
    setFormTransaction(transaction)
    setFormSession((current) => current + 1)
    setFormOpen(true)
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Bank</h1>
        <p className="text-sm text-muted-foreground">Transactions Log</p>
      </div>
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
              ? "No transactions for this account."
              : "No bank transactions yet."
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
            <>
              <CustomizeColumns
                columns={bankTransactionColumns}
                visibility={visibility}
                onVisibilityChange={changeVisibility}
              />
              <Button
                type="button"
                disabled={accounts.length === 0}
                onClick={() => openForm(null)}
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
              <DropdownMenuContent align="end" className="w-56">
                {transaction.linked ? (
                  <DropdownMenuItem disabled>
                    From a payment or expense
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => openForm(transaction)}>
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
      <BankTransactionFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={formTransaction}
        accounts={accounts}
        projects={projects}
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
        title="Delete bank transaction"
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
        <span className="tabular-nums">{formatMoney(transaction[columnId])}</span>
      )
  }
}
