import { getLastBackupStatus, getLookupCatalogs } from "@/app/(app)/settings/queries"
import { getSettingsBankAccounts } from "@/lib/bank-accounts"
import { getFiscalYearStartMonth, getLaunchDate, getPrintMargins } from "@/lib/company-settings"
import { listDocumentTemplates } from "@/lib/document-templates-data"
import type { DocumentTemplate } from "@/lib/document-templates"
import type { BankAccountRow } from "@/lib/bank"
import type { PrintMargins } from "@/lib/documents/drafts"
import type { CatalogList } from "@/lib/lookup-catalogs"
import { requireOwner } from "@/lib/permissions"

export type SettingsPageData = {
  catalogs: CatalogList[]
  documentTemplates: DocumentTemplate[]
  bankAccounts: BankAccountRow[]
  fiscalYearStartMonth: number
  launchDate: string
  printMargins: PrintMargins
  lastBackup: {
    ranAtLabel: string
    sizeLabel: string
    status: string
  } | null
  error: string | null
}

export async function loadSettingsPage(): Promise<SettingsPageData> {
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

  return {
    catalogs,
    documentTemplates: documentTemplates.templates,
    bankAccounts: bankAccounts.accounts,
    fiscalYearStartMonth,
    launchDate,
    printMargins,
    lastBackup,
    error: error ?? bankAccounts.error ?? documentTemplates.error,
  }
}
