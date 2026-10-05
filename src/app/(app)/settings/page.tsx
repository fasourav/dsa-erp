import { getLookupCatalogs } from "@/app/(app)/settings/queries"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const { catalogs, error } = await getLookupCatalogs()

  return <SettingsPanel catalogs={catalogs} error={error} />
}
