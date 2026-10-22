import { notFound } from "next/navigation"

import { loadSettingsPage } from "@/app/(app)/settings/load-settings"
import { SettingsPanel } from "@/app/(app)/settings/settings-panel"
import { catalogByKey, isCatalogKey, type CatalogKey } from "@/lib/lookup-catalogs"

const fixedSections = ["company", "bank", "documents"] as const

type FixedSection = (typeof fixedSections)[number]

function isFixedSection(value: string): value is FixedSection {
  return fixedSections.some((section) => section === value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  return { title: sectionLabel(section) }
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!isFixedSection(section) && !isCatalogKey(section)) notFound()

  const data = await loadSettingsPage()

  return <SettingsPanel section={section} {...data} />
}

function sectionLabel(section: string): string {
  if (section === "company") return "Company"
  if (section === "bank") return "Bank Accounts"
  if (section === "documents") return "Document Templates"
  if (isCatalogKey(section)) return catalogByKey(section as CatalogKey).label
  return "Settings"
}
