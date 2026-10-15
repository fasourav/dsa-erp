"use client"

import { useSeesMoney } from "@/components/access-provider"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

// Atrium money: tabular figures, the ৳ glyph from the Taka subset, and the
// paisa dimmed. Use size="kpi" inside KPI values (smaller, fainter decimals).
export function Money({
  value,
  size = "default",
  className,
}: {
  value: number
  size?: "default" | "kpi"
  className?: string
}) {
  const seesMoney = useSeesMoney()
  if (!seesMoney) return <span className={cn("text-muted-foreground", className)}>Hidden</span>
  const text = formatMoney(value)
  const signIndex = text.indexOf("৳")
  const sign = text.slice(0, signIndex)
  const amount = text.slice(signIndex + 1)
  const dot = amount.lastIndexOf(".")
  const whole = dot === -1 ? amount : amount.slice(0, dot)
  const decimals = dot === -1 ? "" : amount.slice(dot)

  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      {sign}
      <span className="mr-[0.07em] font-medium opacity-90">৳</span>
      {whole}
      {decimals ? (
        <span
          className={cn(
            size === "kpi" ? "text-[0.62em] font-semibold opacity-45" : "opacity-50 md:opacity-55",
          )}
        >
          {decimals}
        </span>
      ) : null}
    </span>
  )
}
