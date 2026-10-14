"use client"

import { ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react"
import Image from "next/image"
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

const pxPerMm = 96 / 25.4
const paper = { width: 210 * pxPerMm, height: 297 * pxPerMm }
const sideMm = 12

type PageSlice = { start: number; end: number }

export function DocumentWorkspace({
  title,
  description,
  margins,
  preview,
  canSave,
  canShare = true,
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
  /** Hide Share for read-only viewers of documents that require edit rights to share. */
  canShare?: boolean
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
    style.textContent = `@media print{@page{size:A4;margin:${top}mm ${sideMm}mm ${bottom}mm;}}`
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
            {canShare ? (
              <Button type="button" variant="outline" onClick={() => void shareDocument()}>
                <Share2 aria-hidden="true" data-icon="inline-start" />
                {copied ? "Link Copied" : "Share"}
              </Button>
            ) : null}
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
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 print:hidden md:grid-cols-2 md:gap-6">
        <Card className={cn("min-w-0", pane === "preview" && "hidden md:flex")}>
          <CardContent className="flex flex-col gap-4">
            {children}
            {files?.parentId ? (
              <RecordAttachments parentType={files.parentType} parentId={files.parentId} />
            ) : null}
          </CardContent>
        </Card>
        <div className={cn("min-w-0", pane === "edit" && "hidden md:block")}>
          <PreviewStage top={top} bottom={bottom} preview={preview} />
        </div>
      </div>
      <div className="hidden print:block">
        <DocumentSheet document={preview} />
      </div>
    </div>
  )
}

function PreviewStage({
  top,
  bottom,
  preview,
}: {
  top: number
  bottom: number
  preview: PrintDocument
}) {
  const frame = useRef<HTMLDivElement>(null)
  const pager = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [slices, setSlices] = useState<PageSlice[]>([{ start: 0, end: 0 }])
  const [page, setPage] = useState(0)
  const bodyHeight = Math.max(1, (297 - top - bottom) * pxPerMm)
  const paged = slices.length > 1
  const current = Math.min(page, slices.length - 1)
  const slice = slices[current]

  useLayoutEffect(() => {
    const frameEl = frame.current
    if (!frameEl) return
    const main = frameEl.closest("main")

    const update = () => {
      const box = getComputedStyle(frameEl)
      const width =
        frameEl.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
      let height = window.innerHeight
      if (main) {
        const mainBox = getComputedStyle(main)
        height =
          main.clientHeight - parseFloat(mainBox.paddingTop) - parseFloat(mainBox.paddingBottom)
      }
      height -= parseFloat(box.paddingTop) + parseFloat(box.paddingBottom)
      if (pager.current) {
        const column = frameEl.parentElement
        const gap = column ? parseFloat(getComputedStyle(column).rowGap) || 0 : 0
        height -= pager.current.offsetHeight + gap
      }
      const next = Math.max(0.1, Math.min(1, width / paper.width, height / paper.height))
      setScale((value) => (value != null && Math.abs(value - next) < 0.001 ? value : next))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(frameEl)
    if (main) observer.observe(main)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [paged])

  useLayoutEffect(() => {
    const root = measure.current
    if (!root) return

    const update = () => {
      const next = paginate(root, bodyHeight)
      setSlices((value) => (sameSlices(value, next) ? value : next))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [bodyHeight, preview])

  const width = scale == null ? undefined : paper.width * scale
  const height = scale == null ? undefined : paper.height * scale

  return (
    <aside aria-label="Live preview" className="flex min-w-0 flex-col gap-3 md:sticky md:top-0">
      <div ref={frame} className="flex min-w-0 justify-center overflow-hidden rounded-card bg-fill p-4 md:p-8">
        <div
          className="relative shrink-0 overflow-hidden rounded-sm shadow-md"
          style={{ width, height, aspectRatio: scale == null ? "210 / 297" : undefined }}
        >
          <div
            className="doc-paper light absolute top-0 left-0 origin-top-left"
            style={{
              transform: `scale(${scale ?? 0})`,
              visibility: scale == null ? "hidden" : undefined,
            }}
          >
            <LetterheadPad />
            <div
              className="doc-paper-body"
              style={{
                top: `${top}mm`,
                left: `${sideMm}mm`,
                right: `${sideMm}mm`,
                height: Math.max(0, slice.end - slice.start),
              }}
            >
              <div style={{ transform: `translateY(${-slice.start}px)` }}>
                <DocumentSheet document={preview} />
              </div>
            </div>
            <div
              ref={measure}
              aria-hidden="true"
              inert
              className="doc-paper-measure"
              style={{ top: `${top}mm`, left: `${sideMm}mm`, right: `${sideMm}mm` }}
            >
              <DocumentSheet document={preview} />
            </div>
          </div>
        </div>
      </div>
      {paged ? (
        <div ref={pager} className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
            Page {current + 1} of {slices.length}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={current === slices.length - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}
    </aside>
  )
}

function LetterheadPad() {
  return (
    <div aria-hidden="true" className="doc-pad">
      <Image
        src="/brand/mark-olive.png"
        alt=""
        width={829}
        height={1002}
        sizes="400px"
        className="doc-pad-watermark"
      />
      <Image
        src="/brand/letterhead-band.svg"
        alt=""
        width={794}
        height={174}
        className="doc-pad-band"
      />
      <div className="doc-pad-contact">
        <p className="doc-pad-company">
          <strong>DYNAMICSPACE</strong> ARCHITECTS &amp; ENGINEERS
        </p>
        <p>H42, R5, E, Banasree, Rampura, Dhaka-1219, Bangladesh</p>
        <p>+8801841 84 88 31 | studio.dynamicspace.bd@gmail.com</p>
        <p className="doc-pad-web">www.studiodynamicspace.com</p>
      </div>
      <div className="doc-pad-services">
        <p>Architecture/</p>
        <p>Interior Design/</p>
        <p>Visualization/</p>
        <p>Construction/</p>
      </div>
      <div className="doc-pad-logo">
        <Image src="/brand/mark-white.png" alt="" width={829} height={1002} sizes="120px" />
        <p className="doc-pad-logo-name">DYNAMICSPACE</p>
        <p className="doc-pad-logo-tag">ARCHITECTS &amp; ENGINEERS</p>
      </div>
    </div>
  )
}

function offsetWithin(element: HTMLElement, root: HTMLElement) {
  let offset = 0
  let node: HTMLElement | null = element
  while (node && node !== root) {
    offset += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return offset
}

type Block = { top: number; bottom: number; rows: number[]; line: { top: number; height: number } | null }

const unbreakable = ".doc-header, .doc-card, .doc-total, .doc-signs, table"

// Mirrors how the print engine breaks .doc-stack: a block that avoids breaks moves
// whole to the next page, a block taller than a page splits between table rows,
// and plain text splits between lines.
function paginate(root: HTMLElement, bodyHeight: number): PageSlice[] {
  const total = root.offsetHeight
  const stack = root.querySelector<HTMLElement>(".doc-stack")
  const blocks: Block[] = Array.from(stack?.children ?? []).map((node) => {
    const element = node as HTMLElement
    const top = offsetWithin(element, root)
    const avoids = element.matches(unbreakable) || element.querySelector(unbreakable) != null
    const text = avoids ? null : element.querySelector<HTMLElement>("p") ?? element
    const lineHeight = text ? parseFloat(getComputedStyle(text).lineHeight) : NaN
    return {
      top,
      bottom: top + element.offsetHeight,
      rows: Array.from(element.querySelectorAll<HTMLElement>("tbody tr")).map((row) =>
        offsetWithin(row, root),
      ),
      line:
        text && lineHeight > 0 ? { top: offsetWithin(text, root), height: lineHeight } : null,
    }
  })

  const slices: PageSlice[] = []
  let start = 0
  while (total - start > bodyHeight + 0.5 && slices.length < 50) {
    const limit = start + bodyHeight
    const block = blocks.find((item) => item.bottom > limit)
    let end = limit
    if (block && block.top <= limit) {
      const lines = block.line ? Math.floor((limit - block.line.top) / block.line.height) : 0
      if (block.line && lines >= 1) {
        end = block.line.top + lines * block.line.height
      } else if (block.top > start + 0.5) {
        end = block.top
      } else {
        const cut = block.rows.filter((row) => row > start + 0.5 && row <= limit).pop()
        if (cut != null) end = cut
      }
    }
    slices.push({ start, end })
    start = end
  }
  slices.push({ start, end: total })
  return slices
}

function sameSlices(a: PageSlice[], b: PageSlice[]) {
  return (
    a.length === b.length &&
    a.every((slice, index) => slice.start === b[index].start && slice.end === b[index].end)
  )
}
