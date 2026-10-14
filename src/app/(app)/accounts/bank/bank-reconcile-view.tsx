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
import { Money } from "@/components/money"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  bankFlowLabel,
  bankSourceLabel,
  type BankAccountRow,
  type BankDirection,
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
import { cn } from "@/lib/utils"

function signedFlow(direction: BankDirection, amount: number) {
  const magnitude = Math.abs(amount)
  return direction === "outflow" ? -magnitude : magnitude
}

export function BankReconcileView({
  accounts,
  account,
  transactions,
  reconciliation,
  periodFrom,
  periodTo,
  showFinancials,
}: {
  accounts: BankAccountRow[]
  account: BankAccountRow | null
  transactions: BankTransactionRow[]
  reconciliation: ReconciliationBundle | null
  periodFrom: string
  periodTo: string
  showFinancials: boolean
}) {
  const router = useRouter()
  const canEdit = useCan("banking", "edit")
  const canDelete = useCan("banking", "delete")
  const [from, setFrom] = useState(periodFrom)
  const [to, setTo] = useState(periodTo)
  const [statementBalance, setStatementBalance] = useState("")
  const [days, setDays] = useState<number | null>(
    defaultToleranceDays(reconciliation?.tolerances ?? []),
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(reconciliation?.error ?? null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StatementLine | null>(null)
  const [pending, start] = useTransition()

  const ledgerHref = account ? `/accounts/bank?account=${account.id}` : "/accounts/bank"

  const accountRows = useMemo(
    () => (account ? transactions.filter((row) => row.bankAccountId === account.id) : []),
    [account, transactions],
  )
  const inPeriod = useMemo(
    () =>
      (reconciliation?.lines ?? []).filter(
        (line) => line.lineDate >= periodFrom && line.lineDate <= periodTo,
      ),
    [reconciliation?.lines, periodFrom, periodTo],
  )
  const matchedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const line of reconciliation?.lines ?? []) {
      if (line.bankTransactionId) ids.add(line.bankTransactionId)
    }
    return ids
  }, [reconciliation?.lines])
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
  const locked = periodOverlaps(reconciliation?.periods ?? [], periodFrom, periodTo)
  const exact = reconciliation?.periods.find(
    (period) => period.periodStart === periodFrom && period.periodEnd === periodTo,
  )
  const book = account ? bookBalanceAsOf(account.openingBalance, accountRows, periodTo) : 0
  const statementValue = exact ? exact.statementBalance : Number(statementBalance)
  const statementKnown = exact != null || (statementBalance.trim() !== "" && Number.isFinite(statementValue))
  const difference = statementKnown ? Math.round((statementValue - (exact?.bookBalance ?? book)) * 100) / 100 : null

  function close() {
    if (pending) return
    router.push(ledgerHref)
  }

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

  const title = account ? reconcileTitle(account.name || "Account") : "Reconcile"

  if (!showFinancials) {
    return (
      <ReconcileDrawer title="Bank" pending={false} onClose={close}>
        <p className="text-sm text-muted-foreground">
          Reconciliation is available when financial figures are visible.
        </p>
      </ReconcileDrawer>
    )
  }

  if (!reconciliation) {
    return (
      <ReconcileDrawer title={title} pending={false} onClose={close}>
        <p className="text-sm text-muted-foreground">
          Reconciliation is available when financial figures are visible.
        </p>
      </ReconcileDrawer>
    )
  }

  if (reconciliation.status === "missing") {
    return (
      <ReconcileDrawer title={title} pending={pending} onClose={close}>
        <p className="text-sm text-muted-foreground">
          Bank reconciliation is not installed on this database yet.
        </p>
      </ReconcileDrawer>
    )
  }

  if (!account) {
    return (
      <ReconcileDrawer title="Choose An Account To Reconcile" pending={pending} onClose={close}>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          {accounts.map((row) => (
            <Button
              key={row.id}
              variant="outline"
              className="w-full justify-start"
              nativeButton={false}
              render={<Link href={`/accounts/bank?view=reconcile&account=${row.id}`} />}
            >
              {row.name || "Account"}
            </Button>
          ))}
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a bank account in Settings first.</p>
        ) : null}
      </ReconcileDrawer>
    )
  }

  const candidates = accountRows.filter((row) => !matchedIds.has(row.id))
  const toleranceItems = reconciliation.tolerances.map((row) => ({
    value: String(row.days),
    label: row.label,
  }))
  const unmatchedLines = inPeriod.filter((line) => !line.bankTransactionId)
  const matchedLines = inPeriod.filter((line) => line.bankTransactionId)

  return (
    <ReconcileDrawer title={title} pending={pending} onClose={close}>
      {locked ? (
        <p className="text-sm text-muted-foreground">This Period Is Reconciled And Locked.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <p className="text-label font-semibold text-muted-foreground">Statement Balance</p>
            {exact ? (
              <p className="text-metric">
                <Money value={exact.statementBalance} />
              </p>
            ) : (
              <Input
                id="statement-balance"
                inputMode="decimal"
                autoComplete="off"
                aria-label="Statement Balance"
                value={statementBalance}
                disabled={!canEdit || pending || locked}
                onChange={(event) => setStatementBalance(event.target.value)}
              />
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col gap-1">
            <p className="text-label font-semibold text-muted-foreground">Book Balance</p>
            <p className="text-metric">
              <Money value={exact?.bookBalance ?? book} />
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="col-span-2 md:col-span-1">
          <CardContent className="flex flex-col gap-1">
            <p className="text-label font-semibold text-muted-foreground">Difference</p>
            <p className="text-metric">
              {difference == null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Money
                  value={difference}
                  className={difference !== 0 ? "text-destructive" : undefined}
                />
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="reconcile-from">From</Label>
          <Input
            id="reconcile-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="reconcile-to">To</Label>
          <Input
            id="reconcile-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={applyPeriod}>
          Apply Period
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
        {toleranceItems.length > 0 && days != null ? (
          <Select
            items={toleranceItems}
            value={String(days)}
            onValueChange={(value) => {
              if (value) setDays(Number(value))
            }}
          >
            <SelectTrigger aria-label="Match Tolerance" className="w-full sm:w-auto">
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
      </div>

      <Tabs defaultValue="unmatched">
        <TabsList>
          <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
          <TabsTrigger value="matched">Matched</TabsTrigger>
        </TabsList>
        <TabsContent value="unmatched" className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-section">Statement Lines</h2>
            {unmatchedLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unmatched statement lines in this period.</p>
            ) : (
              <ul className="flex flex-col">
                {unmatchedLines.map((line) => (
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
          <section className="flex flex-col gap-2">
            <h2 className="text-section">Unmatched Book Lines</h2>
            {bookRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every book line in this period is matched.</p>
            ) : (
              <ul className="flex flex-col">
                {bookRows.map((row) => (
                  <li key={row.id} className="border-b border-border py-4 last:border-b-0">
                    <LedgerAmount row={row} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
        <TabsContent value="matched">
          {matchedLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matched lines in this period.</p>
          ) : (
            <ul className="flex flex-col">
              {matchedLines.map((line) => (
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
        </TabsContent>
      </Tabs>

      {reconciliation.periods.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-section">Locked Periods</h2>
          <ul className="flex flex-col gap-3">
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
    </ReconcileDrawer>
  )
}

function ReconcileDrawer({
  title,
  pending,
  onClose,
  children,
}: {
  title: string
  pending: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent variant="drawer" className="overflow-hidden" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {children}
        </DialogBody>
      </DialogContent>
    </Dialog>
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
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 md:flex-row md:items-start md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-label text-muted-foreground">Statement</p>
        <p className="text-ui font-semibold">
          {line.description || line.reference || "No description"}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatIsoDate(line.lineDate)} · {bankFlowLabel(line.direction)}
        </p>
        <Money
          value={signedFlow(line.direction, line.amount)}
          className={line.direction === "outflow" ? "text-destructive" : "text-success"}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-label text-muted-foreground">Ledger</p>
        {matched ? (
          <>
            <LedgerAmount row={matched} />
            <StatusBadge status="paid" />
            {canEdit ? (
              <Button type="button" variant="outline" disabled={pending || locked} onClick={() => onMatch(null)}>
                Unmatch
              </Button>
            ) : null}
          </>
        ) : canEdit && items.length > 0 ? (
          <Select
            items={items}
            value={null}
            onValueChange={(value) => {
              if (value) onMatch(value)
            }}
          >
            <SelectTrigger aria-label="Match To A Book Line" className="w-full">
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
      </div>
    </li>
  )
}

function LedgerAmount({ row }: { row: BankTransactionRow }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-ui font-semibold">{bankSourceLabel(row.sourceKind)}</p>
        <p className="text-sm text-muted-foreground">
          {formatIsoDate(row.transactionDate)}
          {row.notes.trim() ? ` · ${row.notes.trim()}` : ""}
        </p>
      </div>
      <Money
        value={signedFlow(row.direction, row.amount)}
        className={cn(
          "shrink-0",
          row.direction === "outflow" ? "text-destructive" : "text-success",
        )}
      />
    </div>
  )
}

function LockedPeriodRow({ period }: { period: LockedPeriod }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 md:flex-row md:items-center md:gap-6">
      <p className="text-sm text-muted-foreground">
        {formatIsoDate(period.periodStart)} – {formatIsoDate(period.periodEnd)}
      </p>
      <p className="text-sm">
        Statement <Money value={period.statementBalance} />
      </p>
      <p className="text-sm">
        Book <Money value={period.bookBalance} />
      </p>
      <p className="text-sm">
        Difference{" "}
        <Money
          value={period.difference}
          className={cn(period.difference !== 0 && "text-destructive")}
        />
      </p>
    </div>
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
    { value: "inflow", label: "Inflow" },
    { value: "outflow", label: "Outflow" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Add Statement Line</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {error ? (
            <p role="alert" className="px-1 text-sm text-destructive md:px-0">
              {error}
            </p>
          ) : null}
          <FieldGroup layout="inset">
            <Field span="half">
              <FieldLabel htmlFor="line-date">Date</FieldLabel>
              <Input
                id="line-date"
                type="date"
                enterKeyHint="next"
                value={lineDate}
                onChange={(event) => setLineDate(event.target.value)}
              />
            </Field>
            <Field span="half">
              <FieldLabel htmlFor="line-direction">Direction</FieldLabel>
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
            </Field>
            <Field>
              <FieldLabel htmlFor="line-description">Description</FieldLabel>
              <Input
                id="line-description"
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="next"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <Field span="half">
              <FieldLabel htmlFor="line-amount">Amount</FieldLabel>
              <Input
                id="line-amount"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field span="half">
              <FieldLabel htmlFor="line-reference">Reference</FieldLabel>
              <Input
                id="line-reference"
                autoComplete="off"
                enterKeyHint="done"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
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

function reconcileTitle(name: string) {
  const titled = name.replace(/(^|[\s/–—-])(\p{Ll})/gu, (match) => match.toUpperCase())
  return `Reconcile ${titled}`
}

function bookLabel(row: BankTransactionRow): string {
  const note = row.notes.trim()
  return [formatIsoDate(row.transactionDate), bankFlowLabel(row.direction), formatExactBdt(row.amount), bankSourceLabel(row.sourceKind), note]
    .filter(Boolean)
    .join(" · ")
}
