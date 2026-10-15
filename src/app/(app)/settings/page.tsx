import { getLookupCatalogs } from "@/app/(app)/settings/queries"
import { listDocumentTemplates } from "@/lib/document-templates-data"
import { getStageTemplates } from "@/lib/project-progress-data"
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
    stageTemplates,
    documentTemplates,
  ] = await Promise.all([
    getLookupCatalogs(),
    getSettingsBankAccounts(),
    getFiscalYearStartMonth(),
    getLaunchDate(),
    getPrintMargins(),
    getStageTemplates(),
    listDocumentTemplates(),
  ])

  return (
    <SettingsPanel
      catalogs={catalogs}
      stageTemplates={stageTemplates.templates}
      documentTemplates={documentTemplates.templates}
      bankAccounts={bankAccounts.accounts}
      fiscalYearStartMonth={fiscalYearStartMonth}
      launchDate={launchDate}
      printMargins={printMargins}
      error={error ?? bankAccounts.error ?? stageTemplates.error ?? documentTemplates.error}
    />
  )
}
