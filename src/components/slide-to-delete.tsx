"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ChevronsRight, Trash2 } from "lucide-react"

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
    const { width, height } = track.getBoundingClientRect()
    return Math.max(width - height, 1)
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
    <div
      data-slot="slide-to-delete"
      style={{ "--p": shown } as CSSProperties}
      className="col-span-full flex w-full min-w-0 basis-full flex-col"
    >
      <div className="grid w-full">
        <div
          className={cn(
            "col-start-1 row-start-1 grid grid-cols-2 gap-2.5 self-center transition duration-300 ease-out motion-reduce:transition-none",
            revealed ? "pointer-events-none scale-95 opacity-0" : "scale-100 opacity-100",
          )}
          inert={revealed || undefined}
          aria-hidden={revealed || undefined}
        >
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full md:h-10.5 md:text-ui"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive-solid"
            size="lg"
            className="w-full md:h-10.5 md:text-ui"
            disabled={pending}
            onClick={() => setArmed(true)}
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
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
              "relative h-14.5 w-full touch-none overflow-hidden rounded-full bg-slide-track shadow-slide-track backdrop-blur-xl backdrop-saturate-200 select-none focus-visible:ring-3 focus-visible:ring-destructive/40 md:h-14",
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
            onPointerUp={(event) => {
              event.stopPropagation()
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
                "absolute inset-y-0 left-0 w-[calc(var(--height)+(100%-var(--height))*var(--p))] rounded-full bg-slide-fill [--height:3.625rem] md:[--height:3.5rem]",
                active
                  ? "transition-none"
                  : "transition-[width] duration-200 ease-out motion-reduce:transition-none",
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 left-[calc(var(--height)+(100%-var(--height))*var(--p))] z-10 flex items-center justify-center overflow-hidden px-2 text-row font-bold whitespace-nowrap text-destructive [--height:3.625rem] md:text-callout md:font-strong md:[--height:3.5rem]",
                active
                  ? "transition-none"
                  : "transition-[left] duration-200 ease-out motion-reduce:transition-none",
              )}
            >
              <span aria-live="polite" className={cn(!pending && "text-shimmer motion-safe:animate-shimmer")}>
                {label}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1 left-[calc(0.25rem+(100%-var(--height))*var(--p))] z-10 flex size-12.5 items-center justify-center rounded-full bg-slide-thumb text-on-color shadow-slide-thumb [--height:3.625rem] md:size-12 md:[--height:3.5rem]",
                active
                  ? "transition-none"
                  : "transition-[left] duration-200 ease-out motion-reduce:transition-none",
              )}
            >
              <ChevronsRight className="size-5" strokeWidth={2.4} />
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
