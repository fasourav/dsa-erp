import { createColumnStore } from "@/lib/column-visibility-store"
import {
  defaultBacklogColumns,
  sanitizeBacklogColumns,
  type BacklogColumnVisibility,
} from "@/lib/backlog"

export const backlogColumnStore = createColumnStore<BacklogColumnVisibility>(
  "dsa-erp.backlog.columns",
  defaultBacklogColumns(),
  sanitizeBacklogColumns,
)
