"use client"

import { useEffect, useState } from "react"

import { DsaBadge } from "@/components/dsa-badge"
import { cn } from "@/lib/utils"

const SPLASH_KEY = "dsa-pwa-splash-shown"

export function PwaSplash() {
  const [phase, setPhase] = useState<"active" | "fading" | "done">("done")

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return
      const isStandalonePwa =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      if (!isStandalonePwa) return
      sessionStorage.setItem(SPLASH_KEY, "1")
    } catch {
      return
    }

    const startTimer = window.setTimeout(() => setPhase("active"), 0)
    const fadeTimer = window.setTimeout(() => setPhase("fading"), 2850)
    const doneTimer = window.setTimeout(() => setPhase("done"), 3200)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  if (phase === "done") return null

  return (
    <div
      aria-hidden="true"
      onPointerDown={() => setPhase("done")}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-aurora px-6 transition-opacity duration-300 md:hidden",
        phase === "fading" && "pointer-events-none opacity-0",
      )}
    >
      <DsaBadge priority className="h-24" />
    </div>
  )
}
