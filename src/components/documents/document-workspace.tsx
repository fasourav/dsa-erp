"use client"

import { Printer } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { DocumentSheet } from "@/components/documents/document-sheet"
import { RecordAttachments } from "@/components/record-attachments"
import type { AttachmentParent } from "@/lib/attachments"
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
  files,
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
  files?: { parentType: AttachmentParent; parentId: string | null }
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
        <div className="flex min-w-0 flex-col gap-4 print:hidden">
          {children}
          {files?.parentId ? (
            <RecordAttachments parentType={files.parentType} parentId={files.parentId} />
          ) : null}
        </div>
        <PreviewStage top={top} bottom={bottom}>
          <DocumentSheet document={preview} />
        </PreviewStage>
      </div>
    </div>
  )
}

function PreviewStage({
  top,
  bottom,
  children,
}: {
  top: number
  bottom: number
  children: ReactNode
}) {
  const frame = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const frameEl = frame.current
    const pageEl = page.current
    if (!frameEl || !pageEl) return

    const update = () => {
      const styles = getComputedStyle(frameEl)
      const pad = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
      const available = Math.max(0, frameEl.clientWidth - pad)
      const natural = pageEl.offsetWidth
      const next = natural > 0 ? Math.min(1, available / natural) : 1
      const nextHeight = pageEl.offsetHeight * next
      setScale((current) => (Math.abs(current - next) < 0.001 ? current : next))
      setHeight((current) =>
        current != null && Math.abs(current - nextHeight) < 0.5 ? current : nextHeight,
      )
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(frameEl)
    observer.observe(pageEl)
    return () => observer.disconnect()
  }, [top, bottom])

  return (
    <div
      ref={frame}
      className="doc-stage min-w-0 overflow-hidden rounded-xl bg-muted p-4 sm:p-8 print:overflow-visible print:bg-transparent print:p-0"
    >
      <div className="doc-stage-slot mx-auto" style={{ height: height ?? undefined }}>
        <div
          ref={page}
          className="doc-page doc-pad origin-top shadow-md print:shadow-none"
          style={{
            transform: `scale(${scale})`,
            paddingTop: `${top}mm`,
            paddingRight: "12mm",
            paddingBottom: `${bottom}mm`,
            paddingLeft: "12mm",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
