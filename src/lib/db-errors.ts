export function errorText(error: { message?: string; code?: string } | null): string {
  return error?.message ?? ""
}

export function isCheckViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23514" || /check constraint/i.test(errorText(error))
}

export function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23505" || /duplicate key/i.test(errorText(error))
}

export function isForeignKeyViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "23503" || /foreign key/i.test(errorText(error))
}

export function mentions(error: { message?: string } | null, text: string): boolean {
  return errorText(error).toLowerCase().includes(text.toLowerCase())
}
