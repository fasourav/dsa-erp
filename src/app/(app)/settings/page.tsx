import { getLookupCatalogs } from "@/app/(app)/settings/queries"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"
import { getSettingsBankAccounts } from "@/lib/bank-accounts"
import { getFiscalYearStartMonth, getLaunchDate } from "@/lib/company-settings"
import { requireOwner } from "@/lib/permissions"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  await requireOwner()
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
