"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

const DEADZONE_PX = 6
const DAMPING = 0.75
const PULL_THRESHOLD_PX = 48
const MAX_PULL_PX = 76
const MIN_REFRESH_MS = 450

function isDesktopOrPrint(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return (
    window.matchMedia("(min-width: 768px)").matches ||
    window.matchMedia("print").matches
  )
}

function hasOpenOverlay(): boolean {
  if (typeof document === "undefined") {
    return false
  }
  return Boolean(
    document.querySelector(
      "[data-slot=dialog-content], [data-slot=sheet-content], [data-slot=alert-dialog-content], [data-slot=dropdown-menu-content], [data-slot=select-content], [data-slot=popover-content], [data-base-ui-focus-guard], [role=dialog], [role=alertdialog], [role=listbox], [role=menu]",
    ),
  )
}

function isBlockedTouchTarget(
  target: EventTarget | null,
  mainEl: HTMLElement,
): boolean {
  if (!(target instanceof Element)) {
    return false
  }
  if (target.closest("[data-slot=slider], input[type=range], textarea")) {
    return true
  }
  let node: Element | null = target
  while (node && node !== mainEl) {
    if (node instanceof HTMLElement && node.scrollTop > 0) {
      return true
    }
    node = node.parentElement
  }
  return false
}

export function usePullToRefresh(mainEl: HTMLElement | null) {
  const router = useRouter()
  const [pullDistance, setPullDistance] = useState(0)
  const [holdingRefresh, setHoldingRefresh] = useState(false)
  const [isPending, startTransition] = useTransition()

  const refreshing = holdingRefresh || isPending
  const refreshingRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!mainEl) {
      return
    }

    let active = false
    let pulling = false
    let canceled = false
    let startX = 0
    let startY = 0
    let currentDistance = 0

    function resetGesture() {
      active = false
      pulling = false
      canceled = false
      if (currentDistance !== 0) {
        currentDistance = 0
        setPullDistance(0)
      }
    }

    function onTouchStart(event: TouchEvent) {
      if (
        event.touches.length !== 1 ||
        refreshingRef.current ||
        isDesktopOrPrint() ||
        mainEl!.scrollTop > 1 ||
        hasOpenOverlay() ||
        isBlockedTouchTarget(event.target, mainEl!)
      ) {
        resetGesture()
        return
      }

      const touch = event.touches[0]
      active = true
      pulling = false
      canceled = false
      startX = touch.clientX
      startY = touch.clientY
      currentDistance = 0
    }

    function onTouchMove(event: TouchEvent) {
      if (!active || canceled || refreshingRef.current) {
        return
      }

      if (
        event.touches.length !== 1 ||
        isDesktopOrPrint() ||
        hasOpenOverlay()
      ) {
        canceled = true
        resetGesture()
        return
      }

      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY

      if (!pulling) {
        if (
          mainEl!.scrollTop > 1 ||
          dy < -4 ||
          (Math.abs(dx) > 10 && Math.abs(dx) >= dy)
        ) {
          canceled = true
          resetGesture()
          return
        }

        if (dy <= DEADZONE_PX || dy <= Math.abs(dx) * 1.2) {
          return
        }

        pulling = true
      }

      if (mainEl!.scrollTop > 1) {
        canceled = true
        resetGesture()
        return
      }

      const nextDistance =
        dy <= DEADZONE_PX
          ? 0
          : Math.min(MAX_PULL_PX, Math.round((dy - DEADZONE_PX) * DAMPING))

      if (nextDistance !== currentDistance) {
        currentDistance = nextDistance
        setPullDistance(nextDistance)
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (!active) {
        return
      }

      const shouldRefresh =
        event.type === "touchend" &&
        pulling &&
        !canceled &&
        currentDistance >= PULL_THRESHOLD_PX &&
        mainEl!.scrollTop <= 1 &&
        !refreshingRef.current &&
        !isDesktopOrPrint() &&
        !hasOpenOverlay()

      resetGesture()

      if (shouldRefresh) {
        refreshingRef.current = true
        setHoldingRefresh(true)
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current)
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          setHoldingRefresh(false)
        }, MIN_REFRESH_MS)
        startTransition(() => {
          router.refresh()
        })
      }
    }

    mainEl.addEventListener("touchstart", onTouchStart, { passive: true })
    mainEl.addEventListener("touchmove", onTouchMove, { passive: true })
    mainEl.addEventListener("touchend", onTouchEnd, { passive: true })
    mainEl.addEventListener("touchcancel", onTouchEnd, { passive: true })

    return () => {
      mainEl.removeEventListener("touchstart", onTouchStart)
      mainEl.removeEventListener("touchmove", onTouchMove)
      mainEl.removeEventListener("touchend", onTouchEnd)
      mainEl.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [mainEl, router])

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD_PX)
  const ready = pullDistance >= PULL_THRESHOLD_PX

  return {
    pullDistance,
    progress,
    ready,
    refreshing,
  }
}
