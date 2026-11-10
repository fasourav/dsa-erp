"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type GuardHandler = (href: string, navigate: () => void) => void

let activeGuard: GuardHandler | null = null
let bypassed = false

export function bypassUnsavedChangesGuard(next = true) {
  bypassed = next
}

function isSameUrl(href: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return false
    return (
      url.pathname + url.search ===
      window.location.pathname + window.location.search
    )
  } catch {
    return false
  }
}

export function guardedNavigate(href: string, navigate: () => void) {
  if (!activeGuard || bypassed || isSameUrl(href)) {
    bypassed = false
    navigate()
    return
  }
  activeGuard(href, navigate)
}

export function useUnsavedChangesGuard(
  dirty: boolean,
  options?: { message?: string },
) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const message =
    options?.message ?? "Your changes to this quotation haven't been saved."

  useEffect(() => {
    if (!dirty) {
      bypassed = false
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassed) return
      event.preventDefault()
      event.returnValue = ""
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (bypassed) {
        bypassed = false
        return
      }
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel")?.includes("external")
      ) {
        return
      }
      const rawHref = anchor.getAttribute("href")
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:")
      ) {
        return
      }
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (
        url.pathname + url.search ===
        window.location.pathname + window.location.search
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      const destination = url.pathname + url.search + url.hash
      pendingActionRef.current = () => {
        router.push(destination)
      }
      setConfirmOpen(true)
    }

    const guardHandler: GuardHandler = (_href, navigate) => {
      pendingActionRef.current = navigate
      setConfirmOpen(true)
    }

    activeGuard = guardHandler
    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleDocumentClick, true)

    return () => {
      if (activeGuard === guardHandler) {
        activeGuard = null
      }
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleDocumentClick, true)
    }
  }, [dirty, router])

  const keepEditing = useCallback(() => {
    pendingActionRef.current = null
    setConfirmOpen(false)
  }, [])

  const confirmDiscard = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setConfirmOpen(false)
    if (action) {
      bypassed = true
      action()
    }
  }, [])

  const onOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      pendingActionRef.current = null
    }
    setConfirmOpen(nextOpen)
  }, [])

  return {
    confirmOpen,
    onOpenChange,
    message,
    keepEditing,
    confirmDiscard,
  }
}
