// Shared by server and browser. Do not add server-only imports to this file.
import { formatDayMonYear } from "@/lib/format"
import type { BuiltReport, Emphasis } from "@/lib/reports/types"

export type StatementLine = {
  id: string
  occurredOn: string
  kind: "bill" | "payment"
  reference: string
  project: string
  detail: string
  debit: number
  credit: number
  running: number
}

export type PartyStatement = {
  party: string
  opening: number
  debit: number
  credit: number
  closing: number
  lines: StatementLine[]
}

export function partyDisplayName(
  personName: string | null | undefined,
  companyName: string | null | undefined,
  fallback: string,
): string {
  return personName?.trim() || companyName?.trim() || fallback
}

export function statementPeriodLabel(from: string, to: string): string {
  return `${formatDayMonYear(from)} – ${formatDayMonYear(to)}`
}

export function buildStatementReport({
  title,
  periodLabel,
  debitLabel,
  statement,
  note,
}: {
  title: string
  periodLabel: string
  debitLabel: string
  statement: PartyStatement
  note: string
}): BuiltReport {
  const rows: Array<{ cells: Array<string | number | null>; emphasis: Emphasis }> = [
    {
      cells: ["", "Opening Balance", "", "", null, null, statement.opening],
      emphasis: "subtotal",
    },
    ...statement.lines.map((line) => ({
      cells: [
        line.occurredOn ? formatDayMonYear(line.occurredOn) : "—",
        line.kind === "payment" ? "Payment" : debitLabel.replace(/s$/, ""),
        line.detail && line.detail !== line.reference
          ? `${line.reference} — ${line.detail}`
          : line.reference,
        line.project,
        line.debit || null,
        line.credit || null,
        line.running,
      ],
      emphasis: "plain" as const,
    })),
    {
      cells: ["", "Closing Balance", "", "", statement.debit, statement.credit, statement.closing],
      emphasis: "total",
    },
  ]

  return {
    title,
    periodLabel,
    landscape: true,
    notes: [note],
    tables: [
      {
        title,
        columns: [
          { header: "Date", kind: "text" },
          { header: "Type", kind: "text" },
          { header: "Reference", kind: "text" },
          { header: "Project", kind: "text" },
          { header: debitLabel, kind: "money" },
          { header: "Payments", kind: "money" },
          { header: "Balance", kind: "money" },
        ],
        rows,
      },
    ],
  }
}
