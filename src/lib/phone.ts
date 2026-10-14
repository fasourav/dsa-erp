export const DEFAULT_CALLING_CODE = "880"

export type CallingCode = {
  value: string
  label: string
  country: string
}

// Common codes, Bangladesh first. `label` is what the closed field shows.
export const CALLING_CODES: readonly CallingCode[] = [
  { value: "880", label: "+880", country: "Bangladesh" },
  { value: "91", label: "+91", country: "India" },
  { value: "92", label: "+92", country: "Pakistan" },
  { value: "977", label: "+977", country: "Nepal" },
  { value: "94", label: "+94", country: "Sri Lanka" },
  { value: "1", label: "+1", country: "United States / Canada" },
  { value: "44", label: "+44", country: "United Kingdom" },
  { value: "971", label: "+971", country: "United Arab Emirates" },
  { value: "966", label: "+966", country: "Saudi Arabia" },
  { value: "974", label: "+974", country: "Qatar" },
  { value: "965", label: "+965", country: "Kuwait" },
  { value: "968", label: "+968", country: "Oman" },
  { value: "973", label: "+973", country: "Bahrain" },
  { value: "60", label: "+60", country: "Malaysia" },
  { value: "65", label: "+65", country: "Singapore" },
  { value: "61", label: "+61", country: "Australia" },
  { value: "86", label: "+86", country: "China" },
  { value: "81", label: "+81", country: "Japan" },
  { value: "82", label: "+82", country: "South Korea" },
  { value: "49", label: "+49", country: "Germany" },
  { value: "33", label: "+33", country: "France" },
  { value: "39", label: "+39", country: "Italy" },
  { value: "34", label: "+34", country: "Spain" },
  { value: "31", label: "+31", country: "Netherlands" },
  { value: "66", label: "+66", country: "Thailand" },
  { value: "62", label: "+62", country: "Indonesia" },
  { value: "63", label: "+63", country: "Philippines" },
  { value: "84", label: "+84", country: "Vietnam" },
  { value: "852", label: "+852", country: "Hong Kong" },
  { value: "90", label: "+90", country: "Turkey" },
  { value: "27", label: "+27", country: "South Africa" },
  { value: "234", label: "+234", country: "Nigeria" },
  { value: "254", label: "+254", country: "Kenya" },
]

const CODES_BY_LENGTH = [...CALLING_CODES].sort(
  (left, right) => right.value.length - left.value.length,
)

export function callingCodeByValue(value: string): CallingCode {
  return (
    CALLING_CODES.find((code) => code.value === value) ?? CALLING_CODES[0]
  )
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

function matchCallingCode(digits: string): string | null {
  const match = CODES_BY_LENGTH.find(
    (code) =>
      digits.startsWith(code.value) &&
      digits.length - code.value.length >= 6,
  )
  return match?.value ?? null
}

export function parseStoredPhone(value: string): {
  callingCode: string
  national: string
} {
  const compact = value.trim().replace(/[^\d+]/g, "")
  if (!compact) {
    return { callingCode: DEFAULT_CALLING_CODE, national: "" }
  }

  let digits = digitsOnly(compact)
  const international = compact.startsWith("+") || compact.startsWith("00")
  if (compact.startsWith("00")) {
    digits = digits.replace(/^00/, "")
  }

  if (international) {
    const code = matchCallingCode(digits)
    if (code) {
      return { callingCode: code, national: digits.slice(code.length) }
    }
  }

  if (digits.startsWith(DEFAULT_CALLING_CODE) && digits.length >= 13) {
    return {
      callingCode: DEFAULT_CALLING_CODE,
      national: digits.slice(DEFAULT_CALLING_CODE.length),
    }
  }

  // Legacy vendor numbers were stored locally (017… or 171…). A bare 10-digit
  // value must not be read as country code +1.
  return { callingCode: DEFAULT_CALLING_CODE, national: digits }
}

function groupNational(digits: string): string {
  if (digits.length <= 4) return digits
  const parts: string[] = []
  let rest = digits
  while (rest.length > 4) {
    parts.push(rest.slice(0, 3))
    rest = rest.slice(3)
  }
  parts.push(rest)
  return parts.join(" ")
}

function significantDigits(national: string): string {
  const digits = digitsOnly(national)
  return digits.startsWith("0") ? digits.slice(1) : digits
}

export function toE164(callingCode: string, national: string): string {
  const significant = significantDigits(national)
  if (!significant) return ""
  return `+${callingCode}${significant}`
}

export function toE164FromStored(value: string): string {
  const parsed = parseStoredPhone(value)
  return toE164(parsed.callingCode, parsed.national)
}

export function phoneFieldError(
  callingCode: string,
  national: string,
): string | null {
  const raw = digitsOnly(national)
  if (!raw) return null

  const significant = significantDigits(national)
  if (callingCode === DEFAULT_CALLING_CODE) {
    if (significant.length < 10) {
      return "Enter a phone number with at least 11 digits."
    }
    if (significant.length > 10) {
      return "Enter a valid phone number."
    }
    return null
  }

  const total = callingCode.length + significant.length
  if (significant.length < 6 || total > 15) {
    return "Enter a valid phone number."
  }

  return null
}

export function phoneErrorForStored(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = parseStoredPhone(trimmed)
  return phoneFieldError(parsed.callingCode, parsed.national)
}

/** Digits used to treat 017… and +8801… as the same number. */
export function phoneMatchKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const parsed = parseStoredPhone(trimmed)
  const significant = significantDigits(parsed.national)
  if (!significant) return ""
  return `${parsed.callingCode}${significant}`
}

export function formatPhoneDisplay(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const parsed = parseStoredPhone(trimmed)
  const significant = significantDigits(parsed.national)
  if (!significant) return trimmed

  if (parsed.callingCode === DEFAULT_CALLING_CODE && significant.length === 10) {
    return `+880 ${significant.slice(0, 4)}-${significant.slice(4)}`
  }

  const grouped = groupNational(significant)
  return `+${parsed.callingCode} ${grouped}`
}

export function callingCodeMatches(item: CallingCode, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^\+/, "")
  if (!q) return true
  return (
    item.country.toLowerCase().includes(q) ||
    item.value.includes(q) ||
    item.label.toLowerCase().includes(q)
  )
}
