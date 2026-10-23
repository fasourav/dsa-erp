const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const

const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const

export function moneyRound(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function lineAmount(quantity: string, unitPrice: string): number {
  if (quantity.trim() === "" || unitPrice.trim() === "") return 0
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0
  return moneyRound(qty * price)
}

function underHundred(value: number): string {
  if (value < 20) return ones[value] ?? ""
  const ten = tens[Math.floor(value / 10)] ?? ""
  const one = ones[value % 10] ?? ""
  return one ? `${ten} ${one}` : ten
}

function underThousand(value: number): string {
  const parts: string[] = []
  let rest = value
  if (rest >= 100) {
    parts.push(`${ones[Math.floor(rest / 100)] ?? ""} Hundred`)
    rest %= 100
  }
  if (rest) parts.push(underHundred(rest))
  return parts.join(" ")
}

/** Indian grouping, matching the Set C "Taka … Only" converter. */
function wordsInt(value: number): string {
  if (value <= 0) return "Zero"
  const parts: string[] = []
  const crore = Math.floor(value / 10000000)
  let rest = value % 10000000
  if (crore) parts.push(`${wordsInt(crore)} Crore`)
  const lakh = Math.floor(rest / 100000)
  rest %= 100000
  if (lakh) parts.push(`${underHundred(lakh)} Lakh`)
  const thousand = Math.floor(rest / 1000)
  rest %= 1000
  if (thousand) parts.push(`${underHundred(thousand)} Thousand`)
  if (rest) parts.push(underThousand(rest))
  return parts.join(" ")
}

export function amountInWords(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const sign = safe < 0 ? "Minus " : ""
  const cents = Math.round(Math.abs(safe) * 100)
  const taka = Math.floor(cents / 100)
  const paisa = cents % 100
  let words = `Taka ${wordsInt(taka)}`
  if (paisa) words += ` and ${wordsInt(paisa)} Paisa`
  return `${sign}${words} Only`
}

export function sumAmounts(values: number[]): number {
  return moneyRound(values.reduce((total, value) => total + value, 0))
}
