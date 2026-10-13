import { ReportFilters } from "@/app/(app)/reports/report-filters"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { displayCell } from "@/lib/reports/workbook"
import type { BuiltReport } from "@/lib/reports/types"
import { cn } from "@/lib/utils"

export function ReportView({
  report,
  pdfHref,
  excelHref,
  launch,
  today,
  from,
  to,
}: {
  report: BuiltReport
  pdfHref: string
  excelHref: string
  launch: string
  today: string
  from: string
  to: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Reports</p>
          <h1 className="text-2xl font-medium tracking-tight">{report.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{report.periodLabel}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={pdfHref} className={buttonVariants({ variant: "outline" })}>
            PDF
          </a>
          <a href={excelHref} className={buttonVariants({ variant: "outline" })}>
            Excel
          </a>
        </div>
      </div>
      <ReportFilters launch={launch} today={today} from={from} to={to} />
      {report.tables.map((table) => (
        <section key={table.title} className="flex flex-col gap-2">
          {report.tables.length > 1 ? (
            <h2 className="text-lg font-medium tracking-tight">{table.title}</h2>
          ) : null}
          <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((column) => (
                    <TableHead
                      key={column.header}
                      className={cn(column.kind !== "text" && "text-right")}
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row, rowIndex) => (
                  <TableRow key={`${table.title}-${rowIndex}`}>
                    {row.cells.map((cell, cellIndex) => (
                      <TableCell
                        key={`${table.title}-${rowIndex}-${cellIndex}`}
                        className={cn(
                          "whitespace-normal",
                          table.columns[cellIndex]?.kind !== "text" && "text-right tabular-nums",
                          row.emphasis !== "plain" && "font-medium",
                        )}
                      >
                        {displayCell(cell, table.columns[cellIndex]?.kind ?? "text")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
      {report.notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  )
}
