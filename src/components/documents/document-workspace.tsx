"use client"

import { Download, Share2 } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { DocumentSheet } from "@/components/documents/document-sheet"
import { RecordAttachments } from "@/components/record-attachments"
import type { AttachmentParent } from "@/lib/attachments"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { clampPrintMargin, type PrintMargins } from "@/lib/documents/drafts"
import type { PrintDocument } from "@/lib/documents/present"
import { cn } from "@/lib/utils"

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
  const [pane, setPane] = useState<"edit" | "preview">("edit")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

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

  async function shareDocument() {
    const url = window.location.href
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url })
      } catch {
        // The share sheet was dismissed, or this browser cannot share.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Leave the button labeled Share when the clipboard is unavailable.
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5 print:block">
      <PageHeader
        className="print:hidden!"
        title={title}
        description={description}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => void shareDocument()}>
              <Share2 aria-hidden="true" data-icon="inline-start" />
              {copied ? "Link Copied" : "Share"}
            </Button>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Download aria-hidden="true" data-icon="inline-start" />
              Download PDF
            </Button>
            {canSave ? (
              <Button type="button" disabled={pending} onClick={onSave}>
                {pending ? "Saving…" : "Save"}
              </Button>
            ) : null}
          </>
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive print:hidden!">
          {error}
        </p>
      ) : null}
      <Tabs
        value={pane}
        onValueChange={(value) => setPane(value === "preview" ? "preview" : "edit")}
        className="print:hidden! md:hidden"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6">
        <Card className={cn("min-w-0 print:hidden!", pane === "preview" && "hidden md:flex")}>
          <CardContent className="flex flex-col gap-4">
            {children}
            {files?.parentId ? (
              <RecordAttachments parentType={files.parentType} parentId={files.parentId} />
            ) : null}
          </CardContent>
        </Card>
        <div className={cn("min-w-0", pane === "edit" && "hidden print:block! md:block")}>
          <PreviewStage top={top} bottom={bottom} measureKey={pane}>
            <DocumentSheet document={preview} />
          </PreviewStage>
        </div>
      </div>
    </div>
  )
}

function PreviewStage({
  top,
  bottom,
  measureKey,
  children,
}: {
  top: number
  bottom: number
  measureKey: string
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
  }, [top, bottom, measureKey])

  return (
    <div
      ref={frame}
      className="doc-stage min-w-0 overflow-hidden rounded-card bg-fill p-4 print:overflow-visible print:bg-transparent print:p-0 md:p-8"
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
