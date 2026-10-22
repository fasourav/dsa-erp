// Document numbers:
//   Quotation          Q/DDMMYY-CLIENTCODE-PROJECTCODE-VERSION
//   Purchase / Work    WO/DDMMYY-VENDORCODE-PROJECTCODE
//   Invoice            INV/DDMMYY-CLIENTCODE-PROJECTCODE
//   Money receipt      INC/DDMMYY-CLIENTCODE-PROJECTCODE
// Codes are the uppercase initials of the party or project name.
// A colliding number keeps the same stem and gains -2, -3, …

const NEW_NUMBER =
  /^(?:Q|WO|INV|INC)\/\d{6}-[A-Z0-9]+-[A-Z0-9]+(?:-V\d+)?(?:-\d+)?$/

export function isNewDocumentNumber(value: string): boolean {
  return NEW_NUMBER.test(value.trim())
}

export function nameCode(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, "")[0] ?? "")
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16)
  return initials || "NA"
}

export function documentDateCode(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!match) return "000000"
  return `${match[3]}${match[2]}${match[1].slice(2)}`
}

export function quotationNumber(
  issuedOn: string,
  clientName: string,
  projectName: string,
  version: number,
): string {
  const safe = Number.isFinite(version) && version > 0 ? Math.trunc(version) : 1
  return `Q/${documentDateCode(issuedOn)}-${nameCode(clientName)}-${nameCode(projectName)}-V${safe}`
}

export function orderNumber(issuedOn: string, vendorName: string, projectName: string): string {
  const projectCode = projectName.trim() ? nameCode(projectName) : "OPS"
  return `WO/${documentDateCode(issuedOn)}-${nameCode(vendorName)}-${projectCode}`
}

export function invoiceNumber(issuedOn: string, clientName: string, projectName: string): string {
  return `INV/${documentDateCode(issuedOn)}-${nameCode(clientName)}-${nameCode(projectName)}`
}

export function receiptNumber(issuedOn: string, clientName: string, projectName: string): string {
  return `INC/${documentDateCode(issuedOn)}-${nameCode(clientName)}-${nameCode(projectName)}`
}

export function quotationVersion(documentNo: string): number | null {
  const match = /-V(\d+)(?:-\d+)?$/.exec(documentNo.trim())
  if (!match) return null
  const version = Number(match[1])
  return Number.isFinite(version) ? version : null
}

export function nextQuotationVersion(documentNumbers: readonly string[]): number {
  let max = 0
  for (const documentNo of documentNumbers) {
    const version = quotationVersion(documentNo)
    if (version != null && version > max) max = version
  }
  return max + 1
}

/** attempt 1 is the stem. Later attempts append -2, -3, … */
export function collisionNumber(base: string, attempt: number): string {
  if (!Number.isFinite(attempt) || attempt <= 1) return base
  return `${base}-${Math.trunc(attempt)}`
}
