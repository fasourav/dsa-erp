import { notFound, redirect } from "next/navigation"

import { FormStudio } from "@/app/(app)/documents/forms/form-studio"
import { PageHeader } from "@/components/page-header"
import { allows } from "@/lib/access"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { formSlugs, formTitle, isFormSlug, type FormKind } from "@/lib/documents/form-model"
import { loadFormDraft } from "@/lib/documents/form-queries"
import { loadDocumentCatalog } from "@/lib/documents/queries"
import { getAccess } from "@/lib/permissions"

export default async function FormDocumentPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: slug, id } = await params
  if (!isFormSlug(slug)) notFound()
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  const kind = formSlugs[slug]
  if (!canSee(access, kind)) redirect("/no-access")
  const [loaded, margins, origin, catalog] = await Promise.all([
    loadFormDraft(kind, id, {}),
    getPrintMargins(),
    requestOrigin(),
    loadDocumentCatalog(),
  ])
  if (!loaded.draft) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title={formTitle(kind)} />
        <p role="alert" className="text-sm text-destructive">
          {loaded.error}
        </p>
      </div>
    )
  }
  const canSave =
    kind === "rfq"
      ? allows(access, "purchase_orders", "edit")
      : kind === "delivery_challan"
      ? allows(access, "purchase_orders", "edit") || allows(access, "projects", "edit")
      : kind === "payment_voucher"
        ? allows(access, "vendor_payments", "edit") || allows(access, "expenses", "edit")
        : kind === "salary_slip"
          ? allows(access, "payroll", "edit")
          : kind === "letter"
            ? allows(access, "projects", "edit") || allows(access, "clients", "edit")
            : allows(access, "projects", "edit")
  return (
    <FormStudio
      draft={loaded.draft}
      employees={catalog.employees}
      vendors={catalog.vendors}
      projects={catalog.projects}
      origin={origin}
      margins={margins}
      canSave={canSave}
    />
  )
}

function canSee(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>, kind: FormKind) {
  if (kind === "rfq") return allows(access, "purchase_orders", "view")
  if (kind === "delivery_challan") return allows(access, "purchase_orders", "view") || allows(access, "projects", "view")
  if (kind === "payment_voucher") return allows(access, "vendor_payments", "view") || allows(access, "expenses", "view")
  if (kind === "salary_slip") return allows(access, "payroll", "view")
  if (kind === "letter") return allows(access, "projects", "view") || allows(access, "clients", "view")
  return allows(access, "projects", "view")
}
