"use client"

import { Download, FileSpreadsheet, Printer } from "lucide-react"
import Image from "next/image"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { ReportFilters } from "@/app/(app)/reports/report-filters"
import { DataList } from "@/components/data-list"
import { VerifyQr } from "@/components/documents/verify-qr"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDayMonYear } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import type { ClientProjectOption, PartyStatement, StatementLine } from "@/lib/statements"
import { cn } from "@/lib/utils"

import "./documents/document.css"

type LineColumn = "date" | "type" | "reference" | "project" | "debit" | "credit" | "balance"

const columns: ListColumn<LineColumn>[] = [
  { id: "date", label: "Date", align: "left", locked: true },
  { id: "type", label: "Type", align: "left", locked: true },
  { id: "reference", label: "Reference", align: "left", locked: true },
  { id: "project", label: "Project", align: "left", locked: true },
  { id: "debit", label: "Debit", align: "right", locked: true },
  { id: "credit", label: "Credit", align: "right", locked: true },
  { id: "balance", label: "Balance", align: "right", locked: true },
]

export function StatementView({
  eyebrow,
  title,
  partyName,
  periodLabel,
  debitLabel,
  note,
  launch,
  today,
  from,
  to,
  pdfHref,
  excelHref,
  statement,
  projects,
  projectId,
  qrUrl,
}: {
  eyebrow: string
  title: string
  partyName: string
  periodLabel: string
  debitLabel: string
  note: string
  launch: string
  today: string
  from: string
  to: string
  pdfHref: string
  excelHref: string
  statement: PartyStatement
  projects?: ClientProjectOption[]
  projectId?: string | null
  qrUrl?: string | null
}) {
  const labeledColumns = columns.map((column) =>
    column.id === "debit" ? { ...column, label: debitLabel } : column,
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <div className="print:hidden">
        <PageHeader
          className="mb-0 md:mb-2"
          eyebrow={eyebrow}
          title={title}
          description={`${partyName} · ${periodLabel}`}
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer aria-hidden="true" data-icon="inline-start" />
                Print
              </Button>
              <a href={pdfHref} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden="true" data-icon="inline-start" />
                PDF
              </a>
              <a href={excelHref} className={buttonVariants({ variant: "outline" })}>
                <FileSpreadsheet aria-hidden="true" data-icon="inline-start" />
                Excel
              </a>
            </>
          }
        />
        <div className="mt-3.5 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <ReportFilters launch={launch} today={today} from={from} to={to} />
          {projects ? <ProjectFilter projects={projects} projectId={projectId ?? null} /> : null}
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          <Figure label="Opening Balance" amount={statement.opening} />
          <Figure label={debitLabel} amount={statement.debit} />
          <Figure label="Payments" amount={statement.credit} />
          <Figure label="Closing Balance" amount={statement.closing} />
        </div>
        <div className="mt-3.5">
          <StatementLines columns={labeledColumns} debitLabel={debitLabel} lines={statement.lines} />
        </div>
        <p className="mt-3 px-1 text-label text-muted-foreground">{note}</p>
      </div>
      <StatementPrint
        eyebrow={eyebrow}
        title={title}
        partyName={partyName}
        periodLabel={periodLabel}
        debitLabel={debitLabel}
        note={note}
        statement={statement}
        qrUrl={qrUrl}
      />
    </div>
  )
}

function Figure({ label, amount }: { label: string; amount: number }) {
  return (
    <Card className="min-w-0 gap-0 px-4 py-4 md:px-5 md:py-4">
      <p className="truncate text-label text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 truncate text-metric md:text-kpi", amount < 0 && "text-destructive")}>
        <Money value={amount} size="kpi" />
      </p>
    </Card>
  )
}

function ProjectFilter({
  projects,
  projectId,
}: {
  projects: ClientProjectOption[]
  projectId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const items = [
    { value: "all", label: "All Projects" },
    ...projects.map((project) => ({ value: project.id, label: project.name })),
  ]

  function choose(value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === "all") params.delete("project")
    else params.set("project", value)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <Select items={items} value={projectId ?? "all"} onValueChange={choose}>
      <SelectTrigger id="statement-project" className="w-full md:w-56" aria-label="Project">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function StatementLines({
  columns: lineColumns,
  debitLabel,
  lines,
}: {
  columns: ListColumn<LineColumn>[]
  debitLabel: string
  lines: StatementLine[]
}) {
  const [sort, setSort] = useState<SortState<LineColumn>>({ key: "date", direction: "asc" })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortLines(lines, sort), [lines, sort])
  const pageResult = paginateRows(sorted, page)

  return (
    <DataList
      columns={lineColumns}
      rows={pageResult.rows}
      rowKey={(row) => row.id}
      sort={sort}
      onSort={(id) => {
        setSort((current) => toggleSort(current, id))
        setPage(1)
      }}
      visibility={{}}
      error={null}
      emptyMessage="No Activity In This Period."
      rangeText={rangeLabel(pageResult.rangeStart, pageResult.rangeEnd, pageResult.total, "row", "rows")}
      currentPage={pageResult.currentPage}
      pageCount={pageResult.pageCount}
      onPageChange={setPage}
      pagingLabel="Statement pagination"
      mobileItem={(row) => ({
        title: row.kind === "payment" ? "Payment" : debitLabel.replace(/s$/, ""),
        subtitle: [formatDayMonYear(row.occurredOn), row.reference, row.project].filter(Boolean).join(" · "),
        value: <Money value={row.kind === "payment" ? row.credit : row.debit} />,
        meta: (
          <span className="text-label font-book text-muted-foreground">
            Balance <Money value={row.running} />
          </span>
        ),
      })}
      renderCell={(row, columnId) => renderLine(row, columnId, debitLabel)}
    />
  )
}

function renderLine(row: StatementLine, columnId: LineColumn, debitLabel: string) {
  switch (columnId) {
    case "date":
      return row.occurredOn ? formatDayMonYear(row.occurredOn) : "—"
    case "type":
      return row.kind === "payment" ? "Payment" : debitLabel.replace(/s$/, "")
    case "reference":
      return row.detail && row.detail !== row.reference ? `${row.reference} — ${row.detail}` : row.reference
    case "project":
      return row.project
    case "debit":
      return row.debit ? <Money value={row.debit} /> : <span className="text-muted-foreground">—</span>
    case "credit":
      return row.credit ? <Money value={row.credit} /> : <span className="text-muted-foreground">—</span>
    case "balance":
      return <Money value={row.running} className={row.running < 0 ? "text-destructive" : undefined} />
  }
}

function sortLines(lines: StatementLine[], sort: SortState<LineColumn>): StatementLine[] {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...lines].sort((left, right) => {
    const result = compareLine(left, right, sort.key)
    return result * direction
  })
}

function compareLine(left: StatementLine, right: StatementLine, key: LineColumn): number {
  switch (key) {
    case "date":
      return left.occurredOn.localeCompare(right.occurredOn) || left.id.localeCompare(right.id)
    case "type":
      return left.kind.localeCompare(right.kind)
    case "reference":
      return left.reference.localeCompare(right.reference)
    case "project":
      return left.project.localeCompare(right.project)
    case "debit":
      return left.debit - right.debit
    case "credit":
      return left.credit - right.credit
    case "balance":
      return left.running - right.running
  }
}

function StatementPrint({
  eyebrow,
  title,
  partyName,
  periodLabel,
  debitLabel,
  note,
  statement,
  qrUrl,
}: {
  eyebrow: string
  title: string
  partyName: string
  periodLabel: string
  debitLabel: string
  note: string
  statement: PartyStatement
  qrUrl?: string | null
}) {
  return (
    <div className="hidden print:block">
      <div className="relative min-h-[297mm]">
        <div aria-hidden="true" className="pointer-events-none print:fixed print:inset-x-0 print:top-0 print:h-[297mm]">
          <div className="doc-pad">
          <Image
            src="/brand/letterhead-band.svg"
            alt=""
            width={794}
            height={174}
            className="doc-pad-band"
          />
          <div className="doc-pad-contact">
            <p className="doc-pad-company">
              <strong>DYNAMICSPACE</strong> ARCHITECTS &amp; ENGINEERS
            </p>
            <p>H42, R5, E, Banasree, Rampura, Dhaka-1219, Bangladesh</p>
            <p>+8801841 84 88 31 | studio.dynamicspace.bd@gmail.com</p>
            <p className="doc-pad-web">www.studiodynamicspace.com</p>
          </div>
          </div>
        </div>
        <article className="document-sheet relative z-10 px-6 pt-8 pb-48">
          <header className="doc-header">
            <div>
              <p className="doc-kicker">{eyebrow}</p>
              <h1>{title}</h1>
            </div>
            <div className="doc-meta">
              <p>{partyName}</p>
              <p>{periodLabel}</p>
            </div>
            {qrUrl ? <VerifyQr url={qrUrl} /> : null}
          </header>
          <table className="doc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reference</th>
                <th>Project</th>
                <th className="num">{debitLabel}</th>
                <th className="num">Payments</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td />
                <td>Opening Balance</td>
                <td />
                <td />
                <td />
                <td />
                <td className="num">
                  <Money value={statement.opening} />
                </td>
              </tr>
              {statement.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.occurredOn ? formatDayMonYear(line.occurredOn) : "—"}</td>
                  <td>{line.kind === "payment" ? "Payment" : debitLabel.replace(/s$/, "")}</td>
                  <td>
                    {line.detail && line.detail !== line.reference
                      ? `${line.reference} — ${line.detail}`
                      : line.reference}
                  </td>
                  <td>{line.project}</td>
                  <td className="num">{line.debit ? <Money value={line.debit} /> : "—"}</td>
                  <td className="num">{line.credit ? <Money value={line.credit} /> : "—"}</td>
                  <td className="num">
                    <Money value={line.running} />
                  </td>
                </tr>
              ))}
              <tr>
                <td />
                <td>Closing Balance</td>
                <td />
                <td />
                <td className="num">
                  <Money value={statement.debit} />
                </td>
                <td className="num">
                  <Money value={statement.credit} />
                </td>
                <td className="num">
                  <Money value={statement.closing} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="doc-intro">{note}</p>
        </article>
      </div>
    </div>
  )
}
