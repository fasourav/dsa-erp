export const RECOVERY_PLAN_WORD_LIMIT = 150

export function countWords(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }

  return trimmed.split(/\s+/).length
}

export function recoveryPlanError(value: string): string | null {
  if (countWords(value) > RECOVERY_PLAN_WORD_LIMIT) {
    return "Use 150 words or fewer."
  }

  return null
}

export function recoveryPlanValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
