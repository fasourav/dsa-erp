"use client"

import { Trash2 } from "lucide-react"

import { SlideToDelete } from "@/components/slide-to-delete"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function deleteConfirmMessage(name?: string | null): string {
  const label = name?.replace(/\s+/g, " ").trim()
  if (!label) {
    return "This can't be undone."
  }

  return `${label} will be permanently deleted. This can't be undone.`
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  description,
  error,
  pending,
  confirmKey,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  itemName?: string | null
  description?: string | null
  error: string | null
  pending: boolean
  confirmKey: string | undefined
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? deleteConfirmMessage(itemName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <SlideToDelete
            key={confirmKey}
            pending={pending}
            onConfirm={onConfirm}
            onCancel={() => {
              if (!pending) {
                onOpenChange(false)
              }
            }}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
