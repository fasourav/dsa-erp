"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ComponentProps } from "react"

const HOVER_INTENT_MS = 80

function canHover(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

export function RecordLink({
  onMouseEnter,
  onMouseLeave,
  onFocus,
  ...props
}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function startIntent() {
    if (intent) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setIntent(true)
    }, HOVER_INTENT_MS)
  }

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        if (canHover()) startIntent()
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event)
        clearTimer()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (canHover()) {
          clearTimer()
          setIntent(true)
        }
      }}
    />
  )
}
