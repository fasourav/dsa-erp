"use client"

import { useEffect, useState } from "react"

import { recordVersion, type VersionedTable } from "@/lib/record-version-action"

/** Loads the record's version when an edit dialog opens. Undefined while adding. */
export function useRecordVersion(table: VersionedTable, id: string | null | undefined, open = true) {
  const [version, setVersion] = useState<{ id: string; value: string } | null>(null)
  useEffect(() => {
    if (!id || !open) return
    let live = true
    void recordVersion(table, id).then((value) => {
      if (live && value) setVersion({ id, value })
    })
    return () => {
      live = false
    }
  }, [table, id, open])
  return id && version?.id === id ? version.value : undefined
}
