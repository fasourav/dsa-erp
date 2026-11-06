"use client"

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react"

export const SIDEBAR_CLOSE_DELAY_MS = 180

function isFinePointer(event: PointerEvent<HTMLElement>) {
  return event.pointerType === "mouse" || event.pointerType === "pen"
}

export function useSidebarPresence() {
  const [pointerInside, setPointerInside] = useState(false)
  const [focusInside, setFocusInside] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLeave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = null
  }, [])

  useEffect(() => clearLeave, [clearLeave])

  const onPointerEnter = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isFinePointer(event)) return
      clearLeave()
      setPointerInside(true)
    },
    [clearLeave],
  )

  const onPointerLeave = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isFinePointer(event)) return
      clearLeave()
      leaveTimer.current = setTimeout(() => setPointerInside(false), SIDEBAR_CLOSE_DELAY_MS)
    },
    [clearLeave],
  )

  const onFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
      setFocusInside(true)
    }
  }, [])

  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    setFocusInside(false)
  }, [])

  return {
    pointerInside,
    focusInside,
    handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  }
}
