export type AccountIdentity = {
  name: string
  email: string
  role: string
  roleLabel: string
  designation: string | null
}

export function roleLabel(role: string): string {
  if (role === "owner") return "Owner"
  if (role === "accountant") return "Accountant"
  if (role === "staff") return "Staff"
  if (role === "custom") return "Custom"
  return role
}

export function accountInitials(name: string, email: string): string {
  const source = name.trim() || email.trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : source.slice(0, 2)
  return letters.toUpperCase() || "—"
}

export function accountSubtitle(account: Pick<AccountIdentity, "roleLabel" | "designation">): string {
  const designation = account.designation?.trim()
  return designation || account.roleLabel
}
