import { getLookupCatalogs } from "@/app/(app)/settings/queries"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"
import { getSettingsBankAccounts } from "@/lib/bank-accounts"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const [{ catalogs, error }, bankAccounts] = await Promise.all([
    getLookupCatalogs(),
    getSettingsBankAccounts(),
  ])

  return (
    <SettingsPanel
      catalogs={catalogs}
      bankAccounts={bankAccounts.accounts}
      error={error ?? bankAccounts.error}
    />
  )
}
