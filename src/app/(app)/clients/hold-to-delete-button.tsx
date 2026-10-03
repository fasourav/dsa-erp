"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

const HOLD_DURATION_MS = 4000

export function HoldToDeleteButton({
  onConfirm,
  pending,
}: {
  onConfirm: () => void
  pending: boolean
}) {
  const [progress, setProgress] = useState(0)
  const startedAt = useRef<number | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current)
      }
    }
  }, [])

  function cancelHold() {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    startedAt.current = null
    setProgress(0)
  }

  function beginHold() {
    if (pending || startedAt.current !== null) {
      return
    }

    startedAt.current = performance.now()

    const tick = (now: number) => {
      if (startedAt.current === null) {
        return
      }

      const ratio = Math.min((now - startedAt.current) / HOLD_DURATION_MS, 1)

      if (ratio >= 1) {
        frame.current = null
        startedAt.current = null
        setProgress(0)
        onConfirm()
        return
      }

      setProgress(ratio)
      frame.current = requestAnimationFrame(tick)
    }

    frame.current = requestAnimationFrame(tick)
  }

  const holding = progress > 0
  const fill = pending ? 1 : progress
  const secondsLeft = Math.ceil(((1 - progress) * HOLD_DURATION_MS) / 1000)

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        aria-describedby="hold-to-delete-status"
        className="relative touch-none overflow-hidden select-none"
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          beginHold()
        }}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onLostPointerCapture={cancelHold}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault()
            beginHold()
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault()
            cancelHold()
          }
        }}
        onBlur={cancelHold}
        onClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 origin-left bg-destructive/30"
          style={{ transform: `scaleX(${fill})` }}
        />
        <span className="relative">{pending ? "Deleting…" : "Delete"}</span>
      </Button>
      <p
        id="hold-to-delete-status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {pending
          ? "Deleting client…"
          : holding
            ? `Keep holding… ${secondsLeft}s`
            : "Hold for 4 seconds to delete."}
      </p>
    </div>
  )
}
