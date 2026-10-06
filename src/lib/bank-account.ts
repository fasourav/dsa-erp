export type BankAccountChoice = {
  id: string
  name: string
  isActive: boolean
}

export function defaultBankAccountId(
  accounts: readonly BankAccountChoice[],
  currentId: string,
): string {
  if (currentId && accounts.some((account) => account.id === currentId)) {
    return currentId
  }

  return accounts.find((account) => account.isActive)?.id ?? accounts[0]?.id ?? ""
}
