"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  message,
  onKeepEditing,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
  onKeepEditing: () => void
  onDiscard: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            autoFocus
            className="h-11 md:h-9"
            onClick={onKeepEditing}
          >
            Keep editing
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="h-11 md:h-9"
            onClick={onDiscard}
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
