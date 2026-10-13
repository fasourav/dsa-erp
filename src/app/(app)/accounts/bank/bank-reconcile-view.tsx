"use client"

import { useMemo, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  addStatementLine,
  autoMatchStatement,
  deleteStatementLine,
  importStatementCsv,
  markPeriodReconciled,
  matchStatementLine,
} from "@/app/(app)/accounts/bank/reconcile-actions"
import { useCan } from "@/components/access-provider"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  bankFlowLabel,
  bankSourceLabel,
  type BankAccountRow,
  type BankTransactionRow,
} from "@/lib/bank"
import {
  bookBalanceAsOf,
  defaultToleranceDays,
  periodOverlaps,
  type LockedPeriod,
  type ReconciliationBundle,
  type StatementLine,
} from "@/lib/bank-reconcile"
import { formatExactBdt } from "@/lib/dashboard-metrics"
import { formatIsoDate } from "@/lib/format"

export function BankReconcileView({
  accounts,
  account,
  transactions,
  reconciliation,
  periodFrom,
  periodTo,
}: {
  accounts: BankAccountRow[]
  account: BankAccountRow | null
  transactions: BankTransactionRow[]
  reconciliation: ReconciliationBundle
  periodFrom: string
  periodTo: string
}) {
  const router = useRouter()
  const canEdit = useCan("banking", "edit")
  const canDelete = useCan("banking", "delete")
  const [from, setFrom] = useState(periodFrom)
  const [to, setTo] = useState(periodTo)
  const [statementBalance, setStatementBalance] = useState("")
  const [days, setDays] = useState<number | null>(defaultToleranceDays(reconciliation.tolerances))
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(reconciliation.error)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StatementLine | null>(null)
  const [pending, start] = useTransition()

  const accountRows = useMemo(
    () => (account ? transactions.filter((row) => row.bankAccountId === account.id) : []),
    [account, transactions],
  )
  const inPeriod = useMemo(
    () =>
      reconciliation.lines.filter((line) => line.lineDate >= periodFrom && line.lineDate <= periodTo),
    [reconciliation.lines, periodFrom, periodTo],
  )
  const matchedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const line of reconciliation.lines) {
      if (line.bankTransactionId) ids.add(line.bankTransactionId)
    }
    return ids
  }, [reconciliation.lines])
  const bookRows = useMemo(
    () =>
      accountRows.filter(
        (row) =>
          row.transactionDate >= periodFrom &&
          row.transactionDate <= periodTo &&
          !matchedIds.has(row.id),
      ),
    [accountRows, matchedIds, periodFrom, periodTo],
  )
  const locked = periodOverlaps(reconciliation.periods, periodFrom, periodTo)
  const exact = reconciliation.periods.find(
    (period) => period.periodStart === periodFrom && period.periodEnd === periodTo,
  )
  const book = account ? bookBalanceAsOf(account.openingBalance, accountRows, periodTo) : 0
  const statementValue = exact ? exact.statementBalance : Number(statementBalance)
  const statementKnown = exact != null || (statementBalance.trim() !== "" && Number.isFinite(statementValue))
  const difference = statementKnown ? Math.round((statementValue - (exact?.bookBalance ?? book)) * 100) / 100 : null

  function applyPeriod() {
    if (!account || to < from) {
      setError("Choose a period that ends on or after it starts.")
      return
    }
    const params = new URLSearchParams({
      view: "reconcile",
      account: account.id,
      from,
      to,
    })
    router.push(`/accounts/bank?${params.toString()}`)
  }

  function run(task: () => Promise<{ error: string | null; count?: number }>, success: string) {
    setError(null)
    setNotice(null)
    start(async () => {
      const result = await task()
      if (result.error) {
        setError(result.error)
        return
      }
      setNotice(success)
      router.refresh()
    })
  }

  if (reconciliation.status === "missing") {
    return (
      <Frame account={account}>
        <p className="text-sm text-muted-foreground">
          Bank reconciliation is not installed on this database yet.
        </p>
      </Frame>
    )
  }

  if (!account) {
    return (
      <Frame account={null}>
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((row) => (
            <Link
              key={row.id}
              href={`/accounts/bank?view=reconcile&account=${row.id}`}
              className="rounded-xl border border-border bg-card p-5 hover:bg-accent"
            >
              <span className="font-medium">{row.name || "Account"}</span>
            </Link>
          ))}
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a bank account in Settings first.</p>
        ) : null}
      </Frame>
    )
  }

  const candidates = accountRows.filter((row) => !matchedIds.has(row.id))
  const toleranceItems = reconciliation.tolerances.map((row) => ({
    value: String(row.days),
    label: row.label,
  }))

  return (
    <Frame account={account}>
      {locked ? (
        <p className="text-sm text-muted-foreground">This Period Is Reconciled And Locked.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statement Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {exact ? (
              <p className="text-2xl font-medium tabular-nums">{formatExactBdt(exact.statementBalance)}</p>
            ) : (
              <Input
                id="statement-balance"
                inputMode="decimal"
                aria-label="Statement Balance"
                value={statementBalance}
                disabled={!canEdit || pending || locked}
                onChange={(event) => setStatementBalance(event.target.value)}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Book Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium tabular-nums">
              {formatExactBdt(exact?.bookBalance ?? book)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={difference != null && difference !== 0 ? "text-2xl font-medium tabular-nums text-destructive" : "text-2xl font-medium tabular-nums"}>
              {difference == null ? "—" : formatExactBdt(difference)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reconcile-from">From</Label>
          <Input id="reconcile-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reconcile-to">To</Label>
          <Input id="reconcile-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={applyPeriod}>
          Apply Period
        </Button>
        {toleranceItems.length > 0 && days != null ? (
          <Select
            items={toleranceItems}
            value={String(days)}
            onValueChange={(value) => {
              if (value) setDays(Number(value))
            }}
          >
            <SelectTrigger aria-label="Match Tolerance">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {toleranceItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground">No match tolerance is configured.</p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending || locked || days == null}
            onClick={() =>
              run(
                () =>
                  autoMatchStatement({
                    accountId: account.id,
                    from: periodFrom,
                    to: periodTo,
                    days: days ?? 0,
                  }),
                "Auto-match finished.",
              )
            }
          >
            Auto-Match
          </Button>
        ) : null}
        {canEdit ? (
          <>
            <input
              id="statement-csv"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={pending || locked}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (!file) return
                const formData = new FormData()
                formData.set("accountId", account.id)
                formData.set("file", file)
                run(async () => {
                  const result = await importStatementCsv(formData)
                  return { error: result.error, count: result.count }
                }, "Statement imported.")
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || locked}
              onClick={() => document.getElementById("statement-csv")?.click()}
            >
              Import CSV
            </Button>
            <Button type="button" variant="outline" disabled={pending || locked} onClick={() => setAddOpen(true)}>
              Add Line
            </Button>
          </>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            disabled={pending || locked || !statementKnown}
            onClick={() =>
              run(
                () =>
                  markPeriodReconciled({
                    accountId: account.id,
                    from: periodFrom,
                    to: periodTo,
                    statementBalance: exact ? String(exact.statementBalance) : statementBalance,
                  }),
                "Period marked reconciled.",
              )
            }
          >
            Mark Reconciled
          </Button>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium tracking-tight">Statement Lines</h2>
        {inPeriod.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Statement Lines In This Period.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {inPeriod.map((line) => (
              <StatementCard
                key={line.id}
                line={line}
                transactions={accountRows}
                candidates={candidates}
                locked={locked}
                canEdit={canEdit}
                canDelete={canDelete}
                pending={pending}
                onMatch={(transactionId) =>
                  run(
                    () => matchStatementLine(line.id, transactionId),
                    transactionId ? "Line matched." : "Line unmatched.",
                  )
                }
                onDelete={() => {
                  setError(null)
                  setPendingDelete(line)
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium tracking-tight">Unmatched Book Lines</h2>
        {bookRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every book line in this period is matched.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bookRows.map((row) => (
              <li key={row.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                {bookLabel(row)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reconciliation.periods.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium tracking-tight">Locked Periods</h2>
          <ul className="flex flex-col gap-2">
            {reconciliation.periods.map((period) => (
              <li key={period.id}>
                <LockedPeriodRow period={period} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AddLineDialog
        open={addOpen}
        accountId={account.id}
        defaultDate={periodTo}
        pending={pending}
        error={error}
        onOpenChange={setAddOpen}
        onSubmit={(input) =>
          run(async () => {
            const result = await addStatementLine(input)
            if (!result.error) setAddOpen(false)
            return result
          }, "Line added.")
        }
      />
      <DeleteConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(next) => {
          if (!next && !pending) setPendingDelete(null)
        }}
        title="Delete Statement Line"
        itemName={pendingDelete?.description || pendingDelete?.reference}
        error={error}
        pending={pending}
        confirmKey={pendingDelete?.id}
        onConfirm={() => {
          if (!pendingDelete) return
          const id = pendingDelete.id
          run(async () => {
            const result = await deleteStatementLine(id)
            if (!result.error) setPendingDelete(null)
            return result
          }, "Line deleted.")
        }}
      />
    </Frame>
  )
}

function Frame({
  account,
  children,
}: {
  account: BankAccountRow | null
  children: ReactNode
}) {
  const ledgerHref = account ? `/accounts/bank?account=${account.id}` : "/accounts/bank"
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight">Bank</h1>
          <p className="text-sm text-muted-foreground">
            {account ? `Reconcile ${account.name || "Account"}` : "Choose An Account To Reconcile"}
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href={ledgerHref} />}>
          Ledger
        </Button>
      </div>
      {children}
    </div>
  )
}

function StatementCard({
  line,
  transactions,
  candidates,
  locked,
  canEdit,
  canDelete,
  pending,
  onMatch,
  onDelete,
}: {
  line: StatementLine
  transactions: BankTransactionRow[]
  candidates: BankTransactionRow[]
  locked: boolean
  canEdit: boolean
  canDelete: boolean
  pending: boolean
  onMatch: (transactionId: string | null) => void
  onDelete: () => void
}) {
  const matched = transactions.find((row) => row.id === line.bankTransactionId) ?? null
  const choices = candidates.filter((row) => row.direction === line.direction)
  const items = choices.map((row) => ({ value: row.id, label: bookLabel(row) }))

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          {formatIsoDate(line.lineDate)} · {bankFlowLabel(line.direction)} · {formatExactBdt(line.amount)}
        </p>
        <p className="text-sm text-muted-foreground">
          {line.description || line.reference || "No description"}
        </p>
      </div>
      {matched ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Matched to {bookLabel(matched)}</p>
          {canEdit ? (
            <Button type="button" variant="outline" disabled={pending || locked} onClick={() => onMatch(null)}>
              Unmatch
            </Button>
          ) : null}
        </div>
      ) : canEdit && items.length > 0 ? (
        <Select
          items={items}
          value={null}
          onValueChange={(value) => {
            if (value) onMatch(value)
          }}
        >
          <SelectTrigger aria-label="Match To A Book Line" className="w-full sm:max-w-md">
            <SelectValue placeholder="Match To A Book Line" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm text-muted-foreground">Unmatched</p>
      )}
      {canDelete ? (
        <Button type="button" variant="outline" disabled={pending || locked} onClick={onDelete}>
          Delete
        </Button>
      ) : null}
    </li>
  )
}

function LockedPeriodRow({ period }: { period: LockedPeriod }) {
  return (
    <p className="text-sm text-muted-foreground">
      {formatIsoDate(period.periodStart)} – {formatIsoDate(period.periodEnd)} · Statement{" "}
      {formatExactBdt(period.statementBalance)} · Book {formatExactBdt(period.bookBalance)} · Difference{" "}
      {formatExactBdt(period.difference)}
    </p>
  )
}

function AddLineDialog({
  open,
  accountId,
  defaultDate,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  accountId: string
  defaultDate: string
  pending: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    accountId: string
    lineDate: string
    description: string
    direction: string
    amount: string
    reference: string
  }) => void
}) {
  const [lineDate, setLineDate] = useState(defaultDate)
  const [description, setDescription] = useState("")
  const [direction, setDirection] = useState("inflow")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const directions = [
    { value: "inflow", label: "Incoming" },
    { value: "outflow", label: "Outgoing" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Add Statement Line</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-date">Date</Label>
            <Input id="line-date" type="date" value={lineDate} onChange={(event) => setLineDate(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-description">Description</Label>
            <Input id="line-description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-direction">Direction</Label>
            <Select items={directions} value={direction} onValueChange={(value) => value && setDirection(value)}>
              <SelectTrigger id="line-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {directions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-amount">Amount</Label>
            <Input id="line-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-reference">Reference</Label>
            <Input id="line-reference" value={reference} onChange={(event) => setReference(event.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              onSubmit({ accountId, lineDate, description, direction, amount, reference })
            }
          >
            Add Line
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function bookLabel(row: BankTransactionRow): string {
  const note = row.notes.trim()
  return [formatIsoDate(row.transactionDate), bankFlowLabel(row.direction), formatExactBdt(row.amount), bankSourceLabel(row.sourceKind), note]
    .filter(Boolean)
    .join(" · ")
}
