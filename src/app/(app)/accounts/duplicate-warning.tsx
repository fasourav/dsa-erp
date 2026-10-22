"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Money } from "@/components/money"
import { formatIsoDate } from "@/lib/format"
import type { DuplicateMatch } from "@/lib/duplicate-outflow"

export function DuplicateWarning({
  idPrefix,
  matches,
  confirmed,
  onConfirmedChange,
  reason,
  onReasonChange,
  reasonError,
  disabled,
}: {
  idPrefix: string
  matches: readonly DuplicateMatch[]
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
  reason: string
  onReasonChange: (reason: string) => void
  reasonError: string | null
  disabled: boolean
}) {
  if (matches.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-group border border-border px-4 py-3">
      <p className="text-label">
        A record with this amount on the same bank account is dated within 7 days.
      </p>
      <ul className="flex flex-col gap-2">
        {matches.map((match, index) => (
          <li key={`${match.kind}-${match.date}-${match.label}-${index}`} className="text-label">
            {match.kind} · {formatIsoDate(match.date)} · <Money value={match.amount} /> ·{" "}
            {match.label || "—"}
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
        <Checkbox
          checked={confirmed}
          disabled={disabled}
          onCheckedChange={(checked) => onConfirmedChange(checked === true)}
        />
        This Is Not A Duplicate
      </label>
      <Field data-invalid={Boolean(reasonError) || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-duplicate-reason`}>Reason</FieldLabel>
        <Textarea
          id={`${idPrefix}-duplicate-reason`}
          value={reason}
          disabled={disabled}
          maxLength={300}
          aria-invalid={Boolean(reasonError)}
          placeholder="Why this is a separate cost"
          onChange={(event) => onReasonChange(event.target.value)}
        />
        {reasonError ? <FieldError>{reasonError}</FieldError> : null}
      </Field>
    </div>
  )
}
