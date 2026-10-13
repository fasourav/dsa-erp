"use client"

import { Printer } from "lucide-react"
import { useEffect, type ReactNode } from "react"

import { DocumentSheet } from "@/components/documents/document-sheet"
import { Button } from "@/components/ui/button"
import { clampPrintMargin, type PrintMargins } from "@/lib/documents/drafts"
import type { PrintDocument } from "@/lib/documents/present"

import "./document.css"

export function DocumentWorkspace({
  title,
  description,
  margins,
  preview,
  canSave,
  pending,
  error,
  onSave,
  children,
}: {
  title: string
  description: string
  margins: PrintMargins
  preview: PrintDocument
  canSave: boolean
  pending: boolean
  error: string | null
  onSave: () => void
  children: ReactNode
}) {
  const top = clampPrintMargin(margins.topMm, 32)
  const bottom = clampPrintMargin(margins.bottomMm, 28)

  useEffect(() => {
    const style = document.createElement("style")
    style.setAttribute("data-document-page", "true")
    style.textContent = `@media print{@page{size:A4;margin:${top}mm 12mm ${bottom}mm;}}`
    document.head.appendChild(style)

    const root = document.documentElement
    const beforePrint = () => {
      root.dataset.documentTheme = root.classList.contains("dark") ? "dark" : "light"
      root.classList.remove("dark")
    }
    const afterPrint = () => {
      if (root.dataset.documentTheme === "dark") root.classList.add("dark")
      delete root.dataset.documentTheme
    }
    window.addEventListener("beforeprint", beforePrint)
    window.addEventListener("afterprint", afterPrint)

    return () => {
      style.remove()
      window.removeEventListener("beforeprint", beforePrint)
      window.removeEventListener("afterprint", afterPrint)
    }
  }, [top, bottom])

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4">
        <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canSave ? (
            <Button type="button" disabled={pending} onClick={onSave}>
              {pending ? "Saving…" : "Save"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive print:hidden">
          {error}
        </p>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4 print:hidden">{children}</div>
        <div className="doc-pad min-w-0 overflow-x-auto" style={{ paddingTop: `${top}mm`, paddingBottom: `${bottom}mm` }}>
          <DocumentSheet document={preview} />
        </div>
      </div>
    </div>
  )
}
