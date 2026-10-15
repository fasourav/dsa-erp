import { buildBackup, type BackupQueryClient } from "@/lib/reports/backup"
import { createAdminClient } from "@/lib/supabase/admin"

const LARGE_ZIP_BYTES = 20 * 1024 * 1024
const BACKUP_BUCKET = "backups"

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

export function isBackupEmailEnabled(): boolean {
  const value = process.env.BACKUP_EMAIL_ENABLED?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes"
}

export async function runDailyBackup(admin: AdminClient): Promise<{
  status: "ok" | "error"
  sizeBytes: number | null
  storagePath: string | null
  emailed: false
  error: string | null
}> {
  const built = await buildBackup("json", {
    client: admin as unknown as BackupQueryClient,
    recordActivity: false,
    useBaseTables: true,
  })

  if (built.status !== "ok") {
    const message = "Could not build the backup."
    const recorded = await recordRun(admin, {
      status: "error",
      sizeBytes: null,
      storagePath: null,
      error: message,
    })
    if (recorded) {
      return {
        status: "error",
        sizeBytes: null,
        storagePath: null,
        emailed: false,
        error: recorded,
      }
    }
    return {
      status: "error",
      sizeBytes: null,
      storagePath: null,
      emailed: false,
      error: message,
    }
  }

  const sizeBytes = built.bytes.byteLength
  let storagePath: string | null = null

  if (sizeBytes > LARGE_ZIP_BYTES) {
    const uploaded = await uploadZip(admin, built.bytes)
    if (uploaded.error) {
      const recorded = await recordRun(admin, {
        status: "error",
        sizeBytes,
        storagePath: null,
        error: uploaded.error,
      })
      if (recorded) {
        return {
          status: "error",
          sizeBytes,
          storagePath: null,
          emailed: false,
          error: recorded,
        }
      }
      return {
        status: "error",
        sizeBytes,
        storagePath: null,
        emailed: false,
        error: uploaded.error,
      }
    }
    storagePath = uploaded.path
  }

  const recorded = await recordRun(admin, {
    status: "ok",
    sizeBytes,
    storagePath,
    error: null,
  })
  if (recorded) {
    return {
      status: "error",
      sizeBytes,
      storagePath,
      emailed: false,
      error: recorded,
    }
  }

  return {
    status: "ok",
    sizeBytes,
    storagePath,
    emailed: false,
    error: null,
  }
}

async function uploadZip(
  admin: AdminClient,
  bytes: Uint8Array,
): Promise<{ path: string | null; error: string | null }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const path = `daily/${stamp}/dsa-erp-backup.zip`
  const { error } = await admin.storage.from(BACKUP_BUCKET).upload(path, bytes, {
    contentType: "application/zip",
    upsert: false,
  })
  if (error) {
    return { path: null, error: "Could not store the backup file." }
  }
  return { path, error: null }
}

async function recordRun(
  admin: AdminClient,
  row: {
    status: "ok" | "error"
    sizeBytes: number | null
    storagePath: string | null
    error: string | null
  },
) {
  const { error } = await admin.from("backup_runs").insert({
    size_bytes: row.sizeBytes,
    status: row.status,
    error: row.error,
    storage_path: row.storagePath,
  })
  return error ? "Could not record the backup run." : null
}
