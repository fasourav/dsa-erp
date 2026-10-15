export const STALE_RECORD_MESSAGE =
  "This record was changed elsewhere. Reload and try again."

/** Sends the loaded updated_at so a version trigger can reject a stale edit. */
export function withVersion<T extends object>(values: T, version: string | undefined): T {
  return version ? { ...values, updated_at: version } : values
}

type VersionQuery = { eq: (column: string, value: string) => VersionQuery }

/** Adds `updated_at = version` when a version was loaded. Zero rows means a stale edit. */
export function eqVersion<Q extends VersionQuery>(query: Q, version: string | undefined): Q {
  return version ? (query.eq("updated_at", version) as Q) : query
}

export function missedUpdateMessage(version: string | undefined, missing: string): string {
  return version ? STALE_RECORD_MESSAGE : missing
}

export function staleWriteMessage(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null
  if (error.code === "40001") return STALE_RECORD_MESSAGE
  if (/changed by someone else|changed elsewhere/i.test(error.message ?? "")) return STALE_RECORD_MESSAGE
  return null
}
