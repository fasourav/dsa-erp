import { getLastBackupStatus, getLookupCatalogs } from "@/app/(app)/settings/queries"
import { listDocumentTemplates } from "@/lib/document-templates-data"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"
import { getSettingsBankAccounts } from "@/lib/bank-accounts"
import { getFiscalYearStartMonth, getLaunchDate, getPrintMargins } from "@/lib/company-settings"
import { requireOwner } from "@/lib/permissions"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  await requireOwner()
  const [
    { catalogs, error },
    bankAccounts,
    fiscalYearStartMonth,
    launchDate,
    printMargins,
    documentTemplates,
    lastBackup,
  ] = await Promise.all([
    getLookupCatalogs(),
    getSettingsBankAccounts(),
    getFiscalYearStartMonth(),
    getLaunchDate(),
    getPrintMargins(),
    listDocumentTemplates(),
    getLastBackupStatus(),
  ])

  return (
    <SettingsPanel
      catalogs={catalogs}
      documentTemplates={documentTemplates.templates}
      bankAccounts={bankAccounts.accounts}
      fiscalYearStartMonth={fiscalYearStartMonth}
      launchDate={launchDate}
      printMargins={printMargins}
      lastBackup={lastBackup}
      error={error ?? bankAccounts.error ?? documentTemplates.error}
    />
  )
}
