"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COMPLETE_AT = 0.98
const KEY_STEP = 0.2
const HOLD_MS = 700

export function SlideToDelete({
  onConfirm,
  onCancel,
  pending,
}: {
  onConfirm: () => void
  onCancel: () => void
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
  const [armed, setArmed] = useState(false)
  const revealed = armed || pending
  const shown = pending ? 1 : ratio
  const label = pending ? "Deleting…" : "Slide To Delete"

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
    if (armed && !pending) {
      trackRef.current?.focus()
    }
  }, [armed, pending])

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
    return Math.max(width - 3 * rem, 1)
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

  function releaseDrag(didDrag: boolean) {
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
  }

  return (
    <div className="flex w-full min-w-0 basis-full flex-col">
      <style>{`
        @keyframes slide-delete-shimmer {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(280%); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .slide-delete-shimmer {
            animation: slide-delete-shimmer 2.4s ease-in-out infinite;
          }
        }
      `}</style>
      <div className="grid w-full">
        <div
          className={cn(
            "col-start-1 row-start-1 grid grid-cols-2 gap-2 transition duration-300 ease-out motion-reduce:transition-none",
            revealed ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100",
          )}
          inert={revealed || undefined}
          aria-hidden={revealed || undefined}
        >
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 w-full"
            disabled={pending}
            onClick={() => setArmed(true)}
          >
            Delete
          </Button>
        </div>
        <div
          className={cn(
            "col-start-1 row-start-1 transition duration-300 ease-out motion-reduce:transition-none",
            revealed ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
          )}
          inert={!revealed || undefined}
          aria-hidden={!revealed || undefined}
        >
          <div
            ref={trackRef}
            role="slider"
            tabIndex={revealed && !pending ? 0 : -1}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
            aria-valuetext={pending ? "Deleting" : `${Math.round(shown * 100)} percent`}
            aria-label="Slide To Delete"
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            className={cn(
              "relative h-12 w-full touch-none overflow-hidden rounded-full border border-foreground/15 bg-background/40 shadow-lg ring-1 ring-destructive/25 backdrop-blur-2xl backdrop-saturate-150 select-none before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:z-20 before:h-px before:bg-foreground/30 focus-visible:ring-3 focus-visible:ring-ring",
              pending ? "cursor-default" : "cursor-grab",
              active && !pending && "cursor-grabbing",
            )}
            onPointerDown={(event) => {
              if (!revealed || pending || confirmed.current || event.button !== 0) {
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
              releaseDrag(dragged.current)
            }}
            onPointerCancel={() => {
              if (!dragging.current) {
                return
              }
              releaseDrag(dragged.current)
            }}
            onLostPointerCapture={() => {
              if (!dragging.current) {
                return
              }
              releaseDrag(dragged.current)
            }}
            onKeyDown={(event) => {
              if (!revealed || pending || confirmed.current) {
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
                "absolute inset-y-0 left-0 bg-destructive/65",
                active
                  ? "transition-none"
                  : "transition-[width] duration-200 ease-out motion-reduce:transition-none",
              )}
              style={{
                width: `calc(0.25rem + ${shown} * (100% - 3rem) + 2.5rem)`,
              }}
            />
            <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-14">
              <span className="relative overflow-hidden text-sm font-medium whitespace-nowrap text-destructive">
                <span aria-live="polite">{label}</span>
                {pending ? null : (
                  <span
                    aria-hidden="true"
                    className="slide-delete-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-foreground/25"
                  />
                )}
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center px-14 text-sm font-medium whitespace-nowrap text-destructive-foreground"
                style={{ clipPath: `inset(0 ${Math.max(0, 100 - shown * 100)}% 0 0)` }}
              >
                {label}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1 z-10 flex size-10 items-center justify-center rounded-full border border-destructive-foreground/30 bg-destructive text-destructive-foreground shadow-md before:pointer-events-none before:absolute before:inset-x-2 before:top-1 before:h-px before:rounded-full before:bg-destructive-foreground/70",
                active
                  ? "transition-none"
                  : "transition-[left] duration-200 ease-out motion-reduce:transition-none",
              )}
              style={{ left: `calc(0.25rem + ${shown} * (100% - 3rem))` }}
            >
              <ChevronsRight className="size-4" />
            </span>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
          revealed ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="link"
              disabled={!revealed || pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
