"use client"

import { toast } from "sonner"

export function savedToast(message = "Saved.") {
  toast.success(message)
}
