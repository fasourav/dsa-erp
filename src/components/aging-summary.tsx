import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCount, formatMoney } from "@/lib/format"
import type { AgingSummaryRow } from "@/lib/aging"

export function AgingSummary({
  rows,
  emptyLabel,
}: {
  rows: readonly AgingSummaryRow[]
  emptyLabel: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {rows.map((row) => (
        <Card key={row.bucket} size="sm">
          <CardHeader>
            <CardTitle>{row.bucket}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm font-medium tabular-nums">
              {formatMoney(row.amount)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatCount(row.count)}{" "}
              {row.count === 1 ? "invoice" : "invoices"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
