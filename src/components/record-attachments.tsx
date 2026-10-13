"use client"

import { FileText, Paperclip, Upload } from "lucide-react"
import { useEffect, useId, useState, useTransition } from "react"

import {
  attachmentSignedUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
  type AttachmentRow,
} from "@/app/(app)/attachments/actions"
import { useCan } from "@/components/access-provider"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ATTACHMENT_BYTE_LIMIT,
  attachmentKind,
  attachmentModule,
  type AttachmentParent,
} from "@/lib/attachments"
import type { ModuleKey } from "@/lib/access"
export function RecordAttachments({
  parentType,
  parentId,
  module,
  collapsed = false,
}: {
  parentType: AttachmentParent
  parentId: string
  module?: ModuleKey
  collapsed?: boolean
}) {
  const resolved = module ?? attachmentModule(parentType)
  const permissionModule = resolved ?? "clients"
  const canView = useCan(permissionModule, "view")
  const canEdit = useCan(permissionModule, "edit")
  const canDelete = useCan(permissionModule, "delete")
  const inputId = useId()
  const [open, setOpen] = useState(!collapsed)
  const [rows, setRows] = useState<AttachmentRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<{
    url: string
    fileName: string
    kind: "pdf" | "image" | "file"
  } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!canView || !open) return
    let active = true
    void listAttachments(parentType, parentId).then((result) => {
      if (!active) return
      setRows(result.rows)
      setError(result.error)
    })
    return () => {
      active = false
    }
  }, [canView, open, parentId, parentType])

  if (!resolved || !canView) return null

  function refresh() {
    startTransition(async () => {
      const result = await listAttachments(parentType, parentId)
      setRows(result.rows)
      setError(result.error)
    })
  }

  function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > ATTACHMENT_BYTE_LIMIT) {
      setError("Files must be 10 MB or smaller.")
      return
    }
    const body = new FormData()
    body.set("parentType", parentType)
    body.set("parentId", parentId)
    body.set("file", file)
    startTransition(async () => {
      const result = await uploadAttachment(body)
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      const listed = await listAttachments(parentType, parentId)
      setRows(listed.rows)
      setError(listed.error)
    })
  }

  function openPreview(row: AttachmentRow) {
    startTransition(async () => {
      const result = await attachmentSignedUrl(row.id)
      if (result.error || !result.url) {
        setError(result.error ?? "Could not open this file.")
        return
      }
      setPreview({
        url: result.url,
        fileName: result.fileName ?? row.fileName,
        kind: attachmentKind(result.contentType ?? row.contentType),
      })
      setPreviewOpen(true)
    })
  }

  const deleting = rows.find((row) => row.id === deleteId)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Attachments</h2>
        <div className="flex flex-wrap gap-2">
          {collapsed ? (
            <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>
              <Paperclip aria-hidden="true" className="size-4" />
              {open ? "Hide Files" : `Files${rows.length ? ` (${rows.length})` : ""}`}
            </Button>
          ) : null}
          {canEdit && open ? (
            <>
              <input
                id={inputId}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx,application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ""
                  onFile(file)
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => document.getElementById(inputId)?.click()}
              >
                <Upload aria-hidden="true" className="size-4" />
                Upload
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {open ? (
        <>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Files Yet. PDF, JPG, PNG, WEBP, XLSX, or DOCX up to 10 MB.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(row.byteSize)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" disabled={pending} onClick={() => openPreview(row)}>
                      Preview
                    </Button>
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setDeleteError(null)
                          setDeleteId(row.id)
                        }}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.fileName ?? "Preview"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-col gap-3">
            {preview?.kind === "image" ? (
              // Signed URL from the private attachments bucket.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.fileName}
                className="mx-auto max-h-[70dvh] max-w-full rounded-lg border border-border object-contain"
              />
            ) : null}
            {preview?.kind === "pdf" ? (
              <iframe title={preview.fileName} src={preview.url} className="min-h-[70dvh] w-full rounded-lg border border-border" />
            ) : null}
            {preview?.kind === "file" ? (
              <p className="text-sm text-muted-foreground">
                This file can be downloaded. A preview is available for PDF and images.
              </p>
            ) : null}
            {preview ? (
              <a href={preview.url} className={buttonVariants({ variant: "outline" })}>
                Download
              </a>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={deleteId != null}
        onOpenChange={(next) => {
          if (!next && !pending) setDeleteId(null)
        }}
        title="Delete File"
        itemName={deleting?.fileName}
        error={deleteError}
        pending={pending}
        confirmKey={deleteId ?? undefined}
        onConfirm={() => {
          if (!deleteId) return
          startTransition(async () => {
            const result = await deleteAttachment(deleteId)
            if (result.error) {
              setDeleteError(result.error)
              return
            }
            setDeleteId(null)
            refresh()
          })
        }}
      />
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
