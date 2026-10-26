// New documents:
//   TYPE/DSAE/PROJECTCODE-PARTYCODE/DDMMYYYY
//   RFQ: RFQ/DSAE/PROJECTCODE-or-ADM-VENDORCODE/DDMMYYYY
//   Salary: SAL/DSAE/YYYY-MM/EMPCODE
//   Letter: DSAE/PROJECT-or-ADM/LTR-or-NTC/DDMM-YYYY
// A second document with the same stem gains -2, -3, …
// Quotation revisions add -V2, -V3, …
// Saved documents keep whatever number they already have.

const NEW_NUMBER =
  /^(?:(?:QTN|WO|PO|DC|INV|MR|PV|WCC|RFQ)\/DSAE\/[A-Z0-9]+-[A-Z0-9]+\/\d{8}(?:-V\d+)?(?:-\d+)?|SAL\/DSAE\/\d{4}-\d{2}\/[A-Z0-9]+(?:-\d+)?|DSAE\/[A-Z0-9]+\/(?:LTR|NTC)\/\d{4}-\d{4}(?:-\d+)?|(?:Q|WO|INV|INC)\/\d{6}-[A-Z0-9]+-[A-Z0-9]+(?:-V\d+)?(?:-\d+)?)$/

export function isNewDocumentNumber(value: string): boolean {
  return NEW_NUMBER.test(value.trim())
}

const nameTitles = /^(mr|mrs|ms|md|engr|dr|mohammad|mohammed)\.?$/i

export function nameCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  while (words.length > 1 && nameTitles.test(words[0]?.replace(/[^A-Za-z.]/g, "") ?? "")) {
    words.shift()
  }
  const initials = words
    .map((word) => word.replace(/[^A-Za-z0-9]/g, "")[0] ?? "")
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16)
  return initials || "NA"
}

export function documentDateCode(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!match) return "00000000"
  return `${match[3]}${match[2]}${match[1]}`
}

function projectCode(projectName: string, operational = false): string {
  if (projectName.trim()) return nameCode(projectName)
  return operational ? "OPS" : "NA"
}

function stem(type: string, project: string, party: string, issuedOn: string): string {
  return `${type}/DSAE/${project}-${party}/${documentDateCode(issuedOn)}`
}

export function quotationNumber(
  issuedOn: string,
  clientName: string,
  projectName: string,
  version: number,
): string {
  const safe = Number.isFinite(version) && version > 0 ? Math.trunc(version) : 1
  const base = stem("QTN", projectCode(projectName), nameCode(clientName), issuedOn)
  return safe > 1 ? `${base}-V${safe}` : base
}

export function orderNumber(issuedOn: string, vendorName: string, projectName: string): string {
  return stem("WO", projectCode(projectName, true), nameCode(vendorName), issuedOn)
}

export function purchaseOrderNumber(issuedOn: string, vendorName: string, projectName: string): string {
  return stem("PO", projectCode(projectName, true), nameCode(vendorName), issuedOn)
}

export function challanNumber(issuedOn: string, vendorName: string, projectName: string): string {
  return stem("DC", projectCode(projectName, true), nameCode(vendorName), issuedOn)
}

export function invoiceNumber(issuedOn: string, clientName: string, projectName: string): string {
  return stem("INV", projectCode(projectName), nameCode(clientName), issuedOn)
}

export function receiptNumber(issuedOn: string, clientName: string, projectName: string): string {
  return stem("MR", projectCode(projectName), nameCode(clientName), issuedOn)
}

export function voucherNumber(issuedOn: string, vendorName: string, projectName: string): string {
  return stem("PV", projectCode(projectName, true), nameCode(vendorName), issuedOn)
}

export function certificateNumber(issuedOn: string, clientName: string, projectName: string): string {
  return stem("WCC", projectCode(projectName), nameCode(clientName), issuedOn)
}

/** Request for quotation: the vendor is the party. No project uses ADM. */
export function rfqNumber(issuedOn: string, vendorName: string, projectName: string): string {
  const project = projectName.trim() ? nameCode(projectName) : "ADM"
  return stem("RFQ", project, nameCode(vendorName), issuedOn)
}

export function salaryNumber(periodYear: number, periodMonth: number, employeeCode: string): string {
  const month = String(periodMonth).padStart(2, "0")
  const code = employeeCode.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  return `SAL/DSAE/${periodYear}-${month}/${code || "NA"}`
}

export function letterNumber(issuedOn: string, projectName: string, notice: boolean): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(issuedOn.trim())
  const stamp = match ? `${match[3]}${match[2]}-${match[1]}` : "0000-0000"
  const project = projectName.trim() ? nameCode(projectName) : "ADM"
  return `DSAE/${project}/${notice ? "NTC" : "LTR"}/${stamp}`
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
