"use client"

import { ChevronLeft, ChevronRight, Printer } from "lucide-react"
import Image from "next/image"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { DocumentSheet } from "@/components/documents/document-sheet"
import { RecordAttachments } from "@/components/record-attachments"
import type { AttachmentParent } from "@/lib/attachments"
import { Button } from "@/components/ui/button"
import { clampPrintMargin, type PrintMargins } from "@/lib/documents/drafts"
import type { PrintDocument } from "@/lib/documents/present"

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

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="grid min-w-0 grid-cols-1 gap-6 print:hidden lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="min-w-0">
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
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {children}
          {files?.parentId ? (
            <RecordAttachments parentType={files.parentType} parentId={files.parentId} />
          ) : null}
        </div>
        <PreviewStage top={top} bottom={bottom} document={preview} />
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
  document,
}: {
  top: number
  bottom: number
  document: PrintDocument
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
  }, [bodyHeight, document])

  const width = scale == null ? undefined : paper.width * scale
  const height = scale == null ? undefined : paper.height * scale

  return (
    <aside
      aria-label="Live preview"
      className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-8"
    >
      <div ref={frame} className="flex min-w-0 justify-center rounded-xl bg-muted p-4 sm:p-6">
        <div
          className="relative shrink-0 overflow-hidden rounded-sm shadow-lg"
          style={{ width, height, aspectRatio: scale == null ? "210 / 297" : undefined }}
        >
          <div
            className="doc-paper light absolute left-0 top-0 origin-top-left"
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
                <DocumentSheet document={document} />
              </div>
            </div>
            <div
              ref={measure}
              aria-hidden="true"
              inert
              className="doc-paper-measure"
              style={{ top: `${top}mm`, left: `${sideMm}mm`, right: `${sideMm}mm` }}
            >
              <DocumentSheet document={document} />
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
          <p aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
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

function paginate(root: HTMLElement, bodyHeight: number): PageSlice[] {
  const total = root.offsetHeight
  const breaks = new Set<number>()
  const stack = root.querySelector<HTMLElement>(".doc-stack")
  for (const child of Array.from(stack?.children ?? [])) {
    breaks.add(offsetWithin(child as HTMLElement, root))
  }
  for (const table of Array.from(root.querySelectorAll<HTMLElement>("table"))) {
    if (table.offsetHeight <= bodyHeight) continue
    for (const row of Array.from(table.querySelectorAll<HTMLElement>("tr"))) {
      breaks.add(offsetWithin(row, root))
    }
  }
  const candidates = Array.from(breaks).sort((a, b) => a - b)

  const slices: PageSlice[] = []
  let start = 0
  while (total - start > bodyHeight + 0.5 && slices.length < 50) {
    const limit = start + bodyHeight
    let end = limit
    for (const candidate of candidates) {
      if (candidate > limit) break
      if (candidate > start + bodyHeight * 0.2) end = candidate
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
