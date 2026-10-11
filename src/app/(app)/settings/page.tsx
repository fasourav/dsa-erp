import { getLookupCatalogs } from "@/app/(app)/settings/queries"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"
import { getSettingsBankAccounts } from "@/lib/bank-accounts"
import { getFiscalYearStartMonth, getLaunchDate } from "@/lib/company-settings"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const [{ catalogs, error }, bankAccounts, fiscalYearStartMonth, launchDate] = await Promise.all([
    getLookupCatalogs(),
    getSettingsBankAccounts(),
    getFiscalYearStartMonth(),
    getLaunchDate(),
  ])

  return (
    <SettingsPanel
      catalogs={catalogs}
      bankAccounts={bankAccounts.accounts}
      fiscalYearStartMonth={fiscalYearStartMonth}
      launchDate={launchDate}
      error={error ?? bankAccounts.error}
    />
  )
}
