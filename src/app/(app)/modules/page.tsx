import type { Metadata } from "next"

import { ModulesGrid } from "@/app/(app)/modules/modules-grid"

export const metadata: Metadata = {
  title: "All Modules",
}

export default function ModulesPage() {
  return <ModulesGrid />
}
