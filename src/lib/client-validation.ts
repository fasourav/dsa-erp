const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value)
}

export function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length
}

export function hasMinDigits(value: string, min: number): boolean {
  return countDigits(value) >= min
}

/**
 * Mirrors the Postgres expression behind `clients_unique_name_phone`
 * (`regexp_replace(phone, '[^0-9+]', '', 'g')`) so the live duplicate check
 * agrees with what the database will enforce on save.
 */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/[^0-9+]/g, "")
}

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}
