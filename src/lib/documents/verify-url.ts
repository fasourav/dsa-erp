export function verifyUrl(origin: string, token: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  return `${origin}/verify/${token}`
}
