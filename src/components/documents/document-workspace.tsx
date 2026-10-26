"use client"

import { ChevronLeft, ChevronRight, Download, Printer, Share2, Trash2 } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { useAccess } from "@/components/access-provider"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { NameCombobox } from "@/components/name-combobox"
import { RecordAttachments } from "@/components/record-attachments"
import type { AttachmentParent } from "@/lib/attachments"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deliverPdf } from "@/lib/documents/deliver-pdf"
import { clampPrintMargin, type PrintMargins } from "@/lib/documents/drafts"
import { documentFileName, renderDocument } from "@/lib/documents/setc/render"
import { documentNumberOf, type DocumentModel, type SavedRecordKind } from "@/lib/documents/setc/types"
import { cn } from "@/lib/utils"

const pxPerMm = 96 / 25.4
const paper = { width: 210 * pxPerMm, height: 297 * pxPerMm }
const previewDebounceMs = 350

export function DocumentWorkspace({
  title,
  description,
  margins,
  source,
  record = null,
  canSave,
  canShare = true,
  canTrash = false,
  trashName,
  onTrash,
  pending,
  error,
  dirty = false,
  onSave,
  files,
  templateNames,
  canStartFromTemplate = false,
  onPickTemplate,
  canSaveAsTemplate = false,
  onSaveAsTemplate,
  children,
}: {
  title: string
  description: string
  margins: PrintMargins
  source: DocumentModel
  /** Set only after the document is saved. The PDF is rebuilt on the server from that record. */
  record?: { kind: SavedRecordKind; id: string } | null
  canSave: boolean
  /** Hide Share for read-only viewers of documents that require edit rights to share. */
  canShare?: boolean
  canTrash?: boolean
  trashName?: string
  onTrash?: () => Promise<string | null>
  pending: boolean
  error: string | null
  /** Saved document whose form no longer matches what Download would rebuild. */
  dirty?: boolean
  onSave: () => void
  files?: { parentType: AttachmentParent; parentId: string | null }
  templateNames?: readonly string[]
  canStartFromTemplate?: boolean
  onPickTemplate?: (name: string) => void
  canSaveAsTemplate?: boolean
  onSaveAsTemplate?: (name: string) => Promise<string | null>
  children: ReactNode
}) {
  const top = clampPrintMargin(margins.topMm, 32)
  const bottom = clampPrintMargin(margins.bottomMm, 28)
  const access = useAccess()
  const [pane, setPane] = useState<"edit" | "preview">("edit")
  const [copied, setCopied] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsName, setSaveAsName] = useState("")
  const [saveAsError, setSaveAsError] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [pdfKind, setPdfKind] = useState<"print" | "letterhead" | null>(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const [trashError, setTrashError] = useState<string | null>(null)
  const [trashPending, setTrashPending] = useState(false)
  const showTrash = canTrash && access.isOwner && Boolean(onTrash)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  function openPdf(letterhead: boolean) {
    const popup = window.open("about:blank", "_blank")
    setPdfKind(letterhead ? "letterhead" : "print")
    void createPdf(letterhead, popup)
  }

  async function createPdf(letterhead: boolean, popup: Window | null) {
    try {
      const response = await fetch("/api/documents/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          record?.id
            ? { recordKind: record.kind, id: record.id, letterhead }
            : { source, margins: { topMm: top, bottomMm: bottom }, letterhead, draft: true },
        ),
      })
      if (!response.ok) throw new Error("pdf")
      const bytes = new Uint8Array(await response.arrayBuffer())
      const named = response.headers.get("x-document-filename")
      await deliverPdf(bytes, named || documentFileName(documentNumberOf(source), letterhead), popup)
    } catch {
      if (popup && !popup.closed) popup.close()
      toast.error("Could not create the PDF.")
    } finally {
      setPdfKind(null)
    }
  }

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
            <Button
              type="button"
              variant="outline"
              disabled={pdfKind !== null}
              aria-label="Print"
              onClick={() => openPdf(false)}
            >
              <Printer aria-hidden="true" data-icon="inline-start" />
              {pdfKind === "print" ? "Creating…" : "Print"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pdfKind !== null || (Boolean(record?.id) && dirty)}
              aria-label={Boolean(record?.id) && dirty ? "Save to download" : "Download PDF"}
              title={Boolean(record?.id) && dirty ? "Save the document, then download it." : undefined}
              onClick={() => openPdf(true)}
            >
              <Download aria-hidden="true" data-icon="inline-start" />
              {Boolean(record?.id) && dirty
                ? "Save To Download"
                : pdfKind === "letterhead"
                  ? "Creating…"
                  : "Download PDF"}
            </Button>
            {showTrash ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending || trashPending}
                onClick={() => {
                  setTrashError(null)
                  setTrashOpen(true)
                }}
              >
                <Trash2 aria-hidden="true" data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
            {canSaveAsTemplate ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending || savingTemplate}
                onClick={() => {
                  setSaveAsName("")
                  setSaveAsError(null)
                  setSaveAsOpen(true)
                }}
              >
                Save As Template
              </Button>
            ) : null}
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
            {canStartFromTemplate && templateNames && onPickTemplate ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="start-from-template">Start From Template</Label>
                <NameCombobox
                  id="start-from-template"
                  value={templateName}
                  names={templateNames}
                  disabled={!canSave || pending}
                  placeholder="Choose A Template"
                  onValueChange={(name) => {
                    setTemplateName(name)
                    if (templateNames.includes(name)) onPickTemplate(name)
                  }}
                />
              </div>
            ) : null}
            {children}
            {files?.parentId ? (
              <RecordAttachments parentType={files.parentType} parentId={files.parentId} />
            ) : null}
          </CardContent>
        </Card>
        <div className={cn("min-w-0", pane === "edit" && "hidden md:block")}>
          <PreviewStage source={source} margins={{ topMm: top, bottomMm: bottom }} draft={!record?.id} />
        </div>
      </div>
      {showTrash && onTrash ? (
        <DeleteConfirmDialog
          open={trashOpen}
          onOpenChange={(open) => {
            if (!trashPending) setTrashOpen(open)
          }}
          title="Move To Trash"
          description={
            trashName
              ? `${trashName} will move to Trash. You can restore it later.`
              : "This document will move to Trash. You can restore it later."
          }
          error={trashError}
          pending={trashPending}
          confirmKey={trashOpen ? trashName ?? "trash" : undefined}
          onConfirm={() => {
            setTrashError(null)
            setTrashPending(true)
            void onTrash().then((message) => {
              setTrashPending(false)
              if (message) {
                setTrashError(message)
                return
              }
              setTrashOpen(false)
            })
          }}
        />
      ) : null}
      {canSaveAsTemplate && onSaveAsTemplate ? (
        <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
          <DialogContent className="overflow-hidden sm:max-w-lg print:hidden!" mobileLayout="nav">
            <DialogHeader>
              <DialogTitle>Save As Template</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <FieldGroup layout="inset">
                <Field data-invalid={Boolean(saveAsError) || undefined}>
                  <FieldLabel htmlFor="save-as-template-name">Name</FieldLabel>
                  <Input
                    id="save-as-template-name"
                    value={saveAsName}
                    maxLength={120}
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="done"
                    disabled={savingTemplate}
                    aria-invalid={Boolean(saveAsError)}
                    onChange={(event) => setSaveAsName(event.target.value)}
                  />
                  {saveAsError ? <FieldError>{saveAsError}</FieldError> : null}
                </Field>
              </FieldGroup>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" disabled={savingTemplate} />}>
                Cancel
              </DialogClose>
              <Button
                type="button"
                disabled={savingTemplate}
                onClick={() => {
                  setSaveAsError(null)
                  setSavingTemplate(true)
                  void onSaveAsTemplate(saveAsName).then((error) => {
                    setSavingTemplate(false)
                    if (error) {
                      setSaveAsError(error)
                      return
                    }
                    setSaveAsOpen(false)
                  })
                }}
              >
                {savingTemplate ? "Saving…" : "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

function sameRendered(
  a: { pages: string[]; html: string },
  b: { pages: string[]; html: string },
) {
  return (
    a.html === b.html &&
    a.pages.length === b.pages.length &&
    a.pages.every((html, index) => html === b.pages[index])
  )
}

function PreviewStage({
  source,
  margins,
  draft,
}: {
  source: DocumentModel
  margins: PrintMargins
  draft: boolean
}) {
  const { topMm, bottomMm } = margins
  const frame = useRef<HTMLDivElement>(null)
  const pager = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [rendered, setRendered] = useState(() =>
    renderDocument(source, { topMm, bottomMm }, "letterhead", undefined, draft),
  )
  const applied = useRef({
    kind: source.kind,
    doc: source.doc,
    topMm,
    bottomMm,
    draft,
  })

  useEffect(() => {
    const last = applied.current
    if (
      last.kind === source.kind &&
      last.doc === source.doc &&
      last.topMm === topMm &&
      last.bottomMm === bottomMm &&
      last.draft === draft
    ) {
      return
    }
    const timer = window.setTimeout(() => {
      applied.current = {
        kind: source.kind,
        doc: source.doc,
        topMm,
        bottomMm,
        draft,
      }
      const next = renderDocument(source, { topMm, bottomMm }, "letterhead", undefined, draft)
      const maxPage = Math.max(0, next.pages.length - 1)
      setPage((value) => (value > maxPage ? maxPage : value))
      setRendered((prev) => (sameRendered(prev, next) ? prev : next))
    }, previewDebounceMs)
    return () => window.clearTimeout(timer)
  }, [bottomMm, draft, source, topMm])

  const current = Math.min(page, Math.max(0, rendered.pages.length - 1))
  // srcdoc keeps this page as the base URL, so /documents/setc.css, the fonts,
  // and the letterhead load from the app. A blob URL does not.
  const pageHtml = rendered.pages[current] ?? rendered.html

  useLayoutEffect(() => {
    const frameEl = frame.current
    if (!frameEl) return
    const main = frameEl.closest("main")
    const update = () => {
      const box = getComputedStyle(frameEl)
      const width = frameEl.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
      let height = window.innerHeight
      if (main) {
        const mainBox = getComputedStyle(main)
        height = main.clientHeight - parseFloat(mainBox.paddingTop) - parseFloat(mainBox.paddingBottom)
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
  }, [rendered.pages.length])

  const width = scale == null ? undefined : paper.width * scale
  const height = scale == null ? undefined : paper.height * scale
  const paged = rendered.pages.length > 1

  return (
    <aside aria-label="Live preview" className="flex min-w-0 flex-col gap-3 md:sticky md:top-0">
      <div ref={frame} className="flex min-w-0 justify-center overflow-hidden rounded-card bg-fill p-4 md:p-8">
        <div
          className="relative shrink-0 overflow-hidden bg-white"
          style={{ width, height, aspectRatio: scale == null ? "210 / 297" : undefined }}
        >
          <iframe
            title="Document preview"
            srcDoc={pageHtml}
            scrolling="no"
            className="absolute top-0 left-0 origin-top-left border-0 bg-white"
            style={{
              width: paper.width,
              height: paper.height,
              transform: `scale(${scale ?? 0})`,
              visibility: scale == null ? "hidden" : undefined,
            }}
          />
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
            Page {current + 1} of {rendered.pages.length}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={current >= rendered.pages.length - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : (
        <div ref={pager} />
      )}
    </aside>
  )
}

