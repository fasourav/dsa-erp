"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

const lakhFormatter = new Intl.NumberFormat("en-IN")

function isRawChar(ch: string): boolean {
  return (ch >= "0" && ch <= "9") || ch === "." || ch === "-"
}

export function sanitizeMoneyRaw(
  input: string,
  allowNegative = false,
): { raw: string; rawIndexMap: number[] } {
  let hasMinus = false
  let hasDot = false
  let decCount = 0
  const chars: string[] = []
  const rawIndexMap: number[] = []

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "-" && allowNegative && !hasMinus && chars.length === 0) {
      hasMinus = true
      chars.push("-")
      rawIndexMap.push(i)
      continue
    }
    if (ch === "." && !hasDot) {
      hasDot = true
      chars.push(".")
      rawIndexMap.push(i)
      continue
    }
    if (ch >= "0" && ch <= "9") {
      if (hasDot) {
        if (decCount >= 2) continue
        decCount++
      }
      chars.push(ch)
      rawIndexMap.push(i)
    }
  }

  // Strip redundant leading zeros in the integer part (e.g. "05" -> "5", "00" -> "0")
  const signOffset = hasMinus ? 1 : 0
  let dotIndex = chars.indexOf(".")
  if (dotIndex === -1) dotIndex = chars.length
  while (
    dotIndex - signOffset > 1 &&
    chars[signOffset] === "0"
  ) {
    chars.splice(signOffset, 1)
    rawIndexMap.splice(signOffset, 1)
    dotIndex--
  }

  return { raw: chars.join(""), rawIndexMap }
}

export function formatMoneyDisplay(raw: string, allowNegative = false): string {
  const { raw: clean } = sanitizeMoneyRaw(raw, allowNegative)
  if (!clean || clean === "-") return clean

  const negative = clean.startsWith("-")
  const unsigned = negative ? clean.slice(1) : clean
  const dotIndex = unsigned.indexOf(".")
  const intPart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex)
  const decPart = dotIndex === -1 ? null : unsigned.slice(dotIndex + 1)

  let groupedInt = ""
  if (intPart.length > 0) {
    try {
      groupedInt = lakhFormatter.format(BigInt(intPart))
    } catch {
      groupedInt = intPart
    }
  }

  const sign = negative ? "-" : ""
  if (decPart !== null) {
    return `${sign}${groupedInt}.${decPart}`
  }
  return `${sign}${groupedInt}`
}

function caretPosFromRawCount(formatted: string, rawCount: number): number {
  if (rawCount <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (isRawChar(formatted[i])) {
      seen++
      if (seen === rawCount) {
        return i + 1
      }
    }
  }
  return formatted.length
}

export type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange" | "prefix"
> & {
  value: string
  onValueChange: (raw: string) => void
  allowNegative?: boolean
  prefix?: boolean
  groupClassName?: string
}

export function MoneyInput({
  value,
  onValueChange,
  allowNegative = false,
  prefix = true,
  className,
  groupClassName,
  onKeyDown,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: MoneyInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const pendingCaretRef = React.useRef<number | null>(null)
  const composingRef = React.useRef(false)
  const [composingText, setComposingText] = React.useState<string | null>(null)
  const [, setRenderTick] = React.useState(0)

  const displayValue =
    composingText !== null
      ? composingText
      : formatMoneyDisplay(value, allowNegative)

  React.useLayoutEffect(() => {
    const caret = pendingCaretRef.current
    if (caret === null) return
    pendingCaretRef.current = null
    const el = inputRef.current
    if (el && document.activeElement === el) {
      try {
        el.setSelectionRange(caret, caret)
      } catch {
        // Ignore selection errors on unsupported input states
      }
    }
  })

  function applyInput(inputText: string, selectionStart: number) {
    const { raw, rawIndexMap } = sanitizeMoneyRaw(inputText, allowNegative)
    let rawBeforeCaret = 0
    for (let i = 0; i < rawIndexMap.length; i++) {
      if (rawIndexMap[i] < selectionStart) {
        rawBeforeCaret++
      } else {
        break
      }
    }
    const nextDisplay = formatMoneyDisplay(raw, allowNegative)
    pendingCaretRef.current = caretPosFromRawCount(nextDisplay, rawBeforeCaret)
    if (raw === value && inputText !== nextDisplay) {
      setRenderTick((tick) => tick + 1)
    }
    onValueChange(raw)
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const text = event.target.value
    if (composingRef.current) {
      setComposingText(text)
      return
    }
    const caret = event.target.selectionStart ?? text.length
    applyInput(text, caret)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented || composingRef.current) return

    const el = event.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === null || end === null || start !== end) return

    if (event.key === "Backspace" && start > 0 && el.value[start - 1] === ",") {
      el.setSelectionRange(start - 1, start - 1)
    } else if (
      event.key === "Delete" &&
      start < el.value.length &&
      el.value[start] === ","
    ) {
      el.setSelectionRange(start + 1, start + 1)
    }
  }

  function handleCompositionStart(
    event: React.CompositionEvent<HTMLInputElement>,
  ) {
    composingRef.current = true
    setComposingText(event.currentTarget.value)
    onCompositionStart?.(event)
  }

  function handleCompositionEnd(
    event: React.CompositionEvent<HTMLInputElement>,
  ) {
    composingRef.current = false
    setComposingText(null)
    const text = event.currentTarget.value
    const caret = event.currentTarget.selectionStart ?? text.length
    applyInput(text, caret)
    onCompositionEnd?.(event)
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    const { raw } = sanitizeMoneyRaw(value, allowNegative)
    if (raw.includes(".")) {
      const [intPart, decPart = ""] = raw.split(".")
      const hasDigits = intPart.replace("-", "").length > 0 || decPart.length > 0
      if (hasDigits && decPart.length < 2) {
        const normalizedInt =
          intPart === ""
            ? "0"
            : intPart === "-"
              ? "-0"
              : intPart
        onValueChange(`${normalizedInt}.${decPart.padEnd(2, "0")}`)
      }
    }
    onBlur?.(event)
  }

  const sharedProps = {
    ...props,
    ref: inputRef,
    type: "text" as const,
    inputMode: "decimal" as const,
    autoComplete: "off",
    value: displayValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  }

  if (!prefix) {
    return <Input {...sharedProps} className={cn("tabular-nums", className)} />
  }

  return (
    <InputGroup className={groupClassName}>
      <InputGroupAddon align="inline-start">৳</InputGroupAddon>
      <InputGroupInput
        {...sharedProps}
        className={cn("tabular-nums", className)}
      />
    </InputGroup>
  )
}
