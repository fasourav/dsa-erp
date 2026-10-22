import { loadSettingsPage } from "@/app/(app)/settings/load-settings"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const data = await loadSettingsPage()

  return <SettingsPanel section="home" {...data} />
}
