/** Adds the loaded updated_at to an update so the database rejects a stale edit. */
export function withVersion<T extends object>(values: T, version: string | undefined): T {
  return version ? { ...values, updated_at: version } : values
}
