"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronsRight } from "lucide-react"

import { cn } from "@/lib/utils"

const COMPLETE_AT = 0.98
const KEY_STEP = 0.2
const HOLD_MS = 700

export function SlideToDelete({
  onConfirm,
  pending,
}: {
  onConfirm: () => void
  pending: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const ratioRef = useRef(0)
  const confirmed = useRef(false)
  const dragging = useRef(false)
  const dragOrigin = useRef({ x: 0, ratio: 0 })
  const dragged = useRef(false)
  const holdOrigin = useRef(0)
  const holdFrame = useRef<number | null>(null)
  const wasPending = useRef(pending)
  const [ratio, setRatio] = useState(0)
  const [active, setActive] = useState(false)

  function commitRatio(next: number) {
    const clamped = Math.min(1, Math.max(0, next))
    ratioRef.current = clamped
    setRatio(clamped)
    return clamped
  }

  function confirm() {
    if (confirmed.current || pending) {
      return
    }
    confirmed.current = true
    stopHold()
    dragging.current = false
    setActive(false)
    commitRatio(1)
    onConfirm()
  }

  function stopHold() {
    if (holdFrame.current !== null) {
      cancelAnimationFrame(holdFrame.current)
      holdFrame.current = null
    }
  }

  useEffect(() => {
    return () => stopHold()
  }, [])

  useEffect(() => {
    if (wasPending.current && !pending) {
      confirmed.current = false
      dragging.current = false
      setActive(false)
      commitRatio(0)
    }
    wasPending.current = pending
  }, [pending])

  function travelOf(track: HTMLDivElement) {
    const width = track.getBoundingClientRect().width
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    return Math.max(width - 2.5 * rem, 1)
  }

  function beginHold() {
    if (pending || confirmed.current || holdFrame.current !== null) {
      return
    }
    setActive(true)
    holdOrigin.current = ratioRef.current
    const started = performance.now()
    const tick = (now: number) => {
      const next = holdOrigin.current + (now - started) / HOLD_MS
      if (next >= 1) {
        holdFrame.current = null
        confirm()
        return
      }
      commitRatio(next)
      holdFrame.current = requestAnimationFrame(tick)
    }
    holdFrame.current = requestAnimationFrame(tick)
  }

  function endHold() {
    const running = holdFrame.current !== null
    stopHold()
    setActive(false)
    if (running && !confirmed.current && !pending) {
      const origin = holdOrigin.current
      requestAnimationFrame(() => {
        if (!confirmed.current && !dragging.current) {
          commitRatio(origin)
        }
      })
    }
  }

  const shown = pending ? 1 : ratio

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={pending ? -1 : 0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuetext={pending ? "Deleting" : `${Math.round(shown * 100)} percent`}
      aria-label="Slide To Delete"
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(
        "relative h-11 w-full min-w-0 touch-none overflow-hidden rounded-lg border border-destructive/40 select-none focus-visible:ring-3 focus-visible:ring-ring sm:flex-1",
        pending ? "bg-destructive" : "cursor-grab bg-destructive/10",
        active && !pending && "cursor-grabbing",
      )}
      onPointerDown={(event) => {
        if (pending || confirmed.current || event.button !== 0) {
          return
        }
        const track = trackRef.current
        if (!track) {
          return
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        dragging.current = true
        dragged.current = false
        setActive(true)
        dragOrigin.current = { x: event.clientX, ratio: ratioRef.current }
      }}
      onPointerMove={(event) => {
        if (!dragging.current || pending || confirmed.current) {
          return
        }
        const track = trackRef.current
        if (!track) {
          return
        }
        const delta = event.clientX - dragOrigin.current.x
        if (Math.abs(delta) > 2) {
          dragged.current = true
        }
        commitRatio(dragOrigin.current.ratio + delta / travelOf(track))
      }}
      onPointerUp={() => {
        if (!dragging.current) {
          return
        }
        const didDrag = dragged.current
        dragging.current = false
        setActive(false)
        if (confirmed.current || pending) {
          return
        }
        if (didDrag && ratioRef.current >= COMPLETE_AT) {
          confirm()
          return
        }
        if (!didDrag) {
          return
        }
        requestAnimationFrame(() => {
          if (!confirmed.current && !dragging.current) {
            commitRatio(0)
          }
        })
      }}
      onPointerCancel={() => {
        const didDrag = dragged.current
        dragging.current = false
        setActive(false)
        if (didDrag && !confirmed.current && !pending) {
          requestAnimationFrame(() => {
            if (!confirmed.current && !dragging.current) {
              commitRatio(0)
            }
          })
        }
      }}
      onKeyDown={(event) => {
        if (pending || confirmed.current) {
          return
        }
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault()
          const next = Math.round((ratioRef.current + KEY_STEP) * 100) / 100
          if (next >= 1) {
            confirm()
            return
          }
          commitRatio(next)
          return
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault()
          commitRatio(Math.round((ratioRef.current - KEY_STEP) * 100) / 100)
          return
        }
        if (event.key === "Home") {
          event.preventDefault()
          commitRatio(0)
          return
        }
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault()
          beginHold()
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault()
          endHold()
        }
      }}
      onLostPointerCapture={() => {
        if (!dragging.current) {
          return
        }
        const didDrag = dragged.current
        dragging.current = false
        setActive(false)
        if (didDrag && !confirmed.current && !pending) {
          requestAnimationFrame(() => {
            if (!confirmed.current && !dragging.current) {
              commitRatio(0)
            }
          })
        }
      }}
      onBlur={() => {
        const wasDragging = dragging.current
        dragging.current = false
        endHold()
        if (wasDragging && !confirmed.current) {
          requestAnimationFrame(() => {
            if (!confirmed.current && !dragging.current) {
              commitRatio(0)
            }
          })
        }
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 bg-destructive",
          active ? "transition-none" : "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        )}
        style={{ width: `${shown * 100}%` }}
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center px-12 text-sm font-medium whitespace-nowrap",
          pending ? "text-destructive-foreground" : "text-destructive",
        )}
        aria-live="polite"
      >
        {pending ? "Deleting…" : "Slide To Delete"}
      </span>
      {pending ? null : (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1.5 flex size-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground",
            active ? "transition-none" : "transition-[left] duration-200 ease-out motion-reduce:transition-none",
          )}
          style={{ left: `calc(0.25rem + ${shown} * (100% - 2.5rem))` }}
        >
          <ChevronsRight className="size-4" />
        </span>
      )}
    </div>
  )
}
