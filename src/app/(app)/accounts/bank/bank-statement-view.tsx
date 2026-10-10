"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildBankStatement } from "@/lib/bank-statement"
import type { BankAccountRow, BankTransactionRow } from "@/lib/bank"
import { formatExactBdt } from "@/lib/dashboard-metrics"
import {
  currentFiscalYear,
  currentTaxYear,
  fiscalYearPeriod,
  taxYearPeriod,
} from "@/lib/fiscal-year"
import { formatIsoDate } from "@/lib/format"
import { dhakaToday } from "@/lib/dashboard-metrics"
import { isIsoDate } from "@/lib/project-validation"

const presets = [
  { value: "custom", label: "Custom" },
  { value: "fiscal", label: "Fiscal Year" },
  { value: "tax", label: "Tax Year" },
]

export function BankStatementView({
  accounts,
  transactions,
  fiscalYearStartMonth,
  accountId,
}: {
  accounts: BankAccountRow[]
  transactions: BankTransactionRow[]
  fiscalYearStartMonth: number
  accountId: string | null
}) {
  const today = dhakaToday(new Date())
  const fiscal = currentFiscalYear(fiscalYearStartMonth, today)
  const [preset, setPreset] = useState("fiscal")
  const [startYear, setStartYear] = useState(fiscal.startYear)
  const [from, setFrom] = useState(fiscal.from)
  const [to, setTo] = useState(fiscal.to)
  const [selectedAccount, setSelectedAccount] = useState(accountId ?? "all")

  const period =
    preset === "tax"
      ? taxYearPeriod(startYear)
      : preset === "fiscal"
        ? fiscalYearPeriod(fiscalYearStartMonth, startYear)
        : null
  const rangeFrom = period?.from ?? from
  const rangeTo = period?.to ?? to
  const rangeReady = isIsoDate(rangeFrom) && isIsoDate(rangeTo) && rangeFrom <= rangeTo
  const included =
    selectedAccount === "all"
      ? accounts.map((account) => account.id)
      : accounts.filter((account) => account.id === selectedAccount).map((account) => account.id)
  const openingBalance = accounts
    .filter((account) => included.includes(account.id))
    .reduce((total, account) => total + account.openingBalance, 0)

  const statement = useMemo(
    () =>
      rangeReady
        ? buildBankStatement({
            accountIds: included,
            openingBalance,
            transactions,
            from: rangeFrom,
            to: rangeTo,
            showAccount: selectedAccount === "all",
          })
        : null,
    [included, openingBalance, rangeFrom, rangeReady, rangeTo, selectedAccount, transactions],
  )

  const accountItems = [
    { value: "all", label: "All Accounts" },
    ...accounts.map((account) => ({
      value: account.id,
      label: account.name || "Account",
    })),
  ]
  const selectedName =
    accountItems.find((item) => item.value === selectedAccount)?.label ?? "All Accounts"

  function exportCsv() {
    if (!statement) return
    const rows = [
      ["Date", "Description", "Project", "Money In", "Money Out", "Running Balance"],
      ["", "Opening Balance", "", "", "", money(statement.opening)],
      ...statement.lines.map((line) => [
        line.date,
        line.description,
        line.project,
        line.moneyIn ? money(line.moneyIn) : "",
        line.moneyOut ? money(line.moneyOut) : "",
        money(line.runningBalance),
      ]),
      [
        "",
        "Totals",
        "",
        money(statement.totalIn),
        money(statement.totalOut),
        money(statement.closing),
      ],
    ]
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `bank-statement-${rangeFrom}-to-${rangeTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 print:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-fit"
          render={<Link href={accountId ? `/accounts/bank?account=${accountId}` : "/accounts/bank"} />}
        >
          Back To Transactions
        </Button>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="statement-account">Account</Label>
            <Select
              items={accountItems}
              value={selectedAccount}
              onValueChange={(value) => setSelectedAccount(value ?? "all")}
            >
              <SelectTrigger id="statement-account" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {accountItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="statement-preset">Period</Label>
            <Select
              items={presets}
              value={preset}
              onValueChange={(value) => {
                const next = value ?? "custom"
                setPreset(next)
                if (next === "fiscal") {
                  setStartYear(currentFiscalYear(fiscalYearStartMonth, today).startYear)
                }
                if (next === "tax") {
                  setStartYear(currentTaxYear(today).startYear)
                }
              }}
            >
              <SelectTrigger id="statement-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {presets.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {period ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" onClick={() => setStartYear((year) => year - 1)}>
              Previous
            </Button>
            <p className="text-sm font-medium">{period.label}</p>
            <Button type="button" variant="outline" onClick={() => setStartYear((year) => year + 1)}>
              Next
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="statement-from">From</Label>
              <Input
                id="statement-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="statement-to">To</Label>
              <Input
                id="statement-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <Button type="button" variant="outline" disabled={!statement} onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-tight">Bank Statement</h2>
        <p className="text-sm text-muted-foreground">
          {selectedName}
          {period ? ` · ${period.label}` : ""}
          {rangeReady ? ` · ${formatIsoDate(rangeFrom)} – ${formatIsoDate(rangeTo)}` : ""}
        </p>
      </div>

      {!rangeReady || !statement ? (
        <p className="text-sm text-muted-foreground">Choose a start date on or before the end date.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Opening Balance{" "}
            <span className="font-medium tabular-nums">{formatExactBdt(statement.opening)}</span>
          </p>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Project</th>
                  <th className="px-2 py-2 text-right font-medium">Money In</th>
                  <th className="px-2 py-2 text-right font-medium">Money Out</th>
                  <th className="px-2 py-2 text-right font-medium">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-muted-foreground">
                      No Transactions In This Period.
                    </td>
                  </tr>
                ) : (
                  statement.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border">
                      <td className="px-2 py-2 whitespace-nowrap">{formatIsoDate(line.date)}</td>
                      <td className="px-2 py-2">{line.description}</td>
                      <td className="px-2 py-2">{line.project || "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {line.moneyIn ? formatExactBdt(line.moneyIn) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {line.moneyOut ? formatExactBdt(line.moneyOut) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatExactBdt(line.runningBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>
              Total In{" "}
              <span className="font-medium tabular-nums">{formatExactBdt(statement.totalIn)}</span>
            </p>
            <p>
              Total Out{" "}
              <span className="font-medium tabular-nums">{formatExactBdt(statement.totalOut)}</span>
            </p>
            <p>
              Closing Balance{" "}
              <span className="font-medium tabular-nums">{formatExactBdt(statement.closing)}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function money(value: number): string {
  return value.toFixed(2)
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}
