import { getLookupCatalogs } from "@/app/(app)/settings/queries"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"
import { getSettingsBankAccounts } from "@/lib/bank-accounts"
import { getFiscalYearStartMonth } from "@/lib/company-settings"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const [{ catalogs, error }, bankAccounts, fiscalYearStartMonth] = await Promise.all([
    getLookupCatalogs(),
    getSettingsBankAccounts(),
    getFiscalYearStartMonth(),
  ])

  return (
    <SettingsPanel
      catalogs={catalogs}
      bankAccounts={bankAccounts.accounts}
      fiscalYearStartMonth={fiscalYearStartMonth}
      error={error ?? bankAccounts.error}
    />
  )
}
