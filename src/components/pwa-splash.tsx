"use client"

import { useEffect } from "react"

import { DsaBadge } from "@/components/dsa-badge"

const SPLASH_KEY = "dsa-pwa-splash-shown"

function dismissSplash() {
  delete document.documentElement.dataset.pwaSplash
  try {
    sessionStorage.setItem(SPLASH_KEY, "1")
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}

export function PwaSplash() {
  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.pwaSplash !== "active") return

    try {
      sessionStorage.setItem(SPLASH_KEY, "1")
    } catch {
      // Ignore storage errors in restricted contexts.
    }

    const fadeTimer = window.setTimeout(() => {
      if (root.dataset.pwaSplash === "active") {
        root.dataset.pwaSplash = "fading"
      }
    }, 2850)
    const doneTimer = window.setTimeout(() => {
      delete root.dataset.pwaSplash
    }, 3200)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      onPointerDown={dismissSplash}
      className="fixed inset-0 z-50 hidden items-center justify-center bg-aurora px-6 transition-opacity duration-300 in-data-[pwa-splash=active]:flex in-data-[pwa-splash=fading]:pointer-events-none in-data-[pwa-splash=fading]:flex in-data-[pwa-splash=fading]:opacity-0"
    >
      <DsaBadge priority className="h-24" />
    </div>
  )
}
