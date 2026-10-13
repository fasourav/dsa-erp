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
  if (value < 100) return underHundred(value)
  const hundred = ones[Math.floor(value / 100)] ?? ""
  const rest = value % 100
  return rest ? `${hundred} Hundred ${underHundred(rest)}` : `${hundred} Hundred`
}

function indianWords(value: number): string {
  if (value <= 0) return ""
  if (value < 1000) return underThousand(value)
  if (value < 100000) {
    const thousand = Math.floor(value / 1000)
    const rest = value % 1000
    return [underHundred(thousand) + " Thousand", rest ? underThousand(rest) : ""]
      .filter(Boolean)
      .join(" ")
  }
  if (value < 10000000) {
    const lakh = Math.floor(value / 100000)
    const rest = value % 100000
    return [`${underHundred(lakh)} Lakh`, indianWords(rest)].filter(Boolean).join(" ")
  }
  const crore = Math.floor(value / 10000000)
  const rest = value % 10000000
  return [`${indianWords(crore)} Crore`, indianWords(rest)].filter(Boolean).join(" ")
}

export function amountInWords(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const sign = safe < 0 ? "Minus " : ""
  const cents = Math.round(Math.abs(safe) * 100)
  const taka = Math.floor(cents / 100)
  const paisa = cents % 100
  const takaWords = taka === 0 ? "" : indianWords(taka)
  const paisaWords = paisa === 0 ? "" : `${underHundred(paisa)} Paisa`

  if (!takaWords && !paisaWords) return "Taka Zero Only"
  if (takaWords && paisaWords) return `${sign}Taka ${takaWords} And ${paisaWords} Only`
  if (paisaWords) return `${sign}Taka ${paisaWords} Only`
  return `${sign}Taka ${takaWords} Only`
}

export function sumAmounts(values: number[]): number {
  return moneyRound(values.reduce((total, value) => total + value, 0))
}
