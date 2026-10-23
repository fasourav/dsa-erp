import { notFound, redirect } from "next/navigation"

import { FormStudio } from "@/app/(app)/documents/forms/form-studio"
import { PageHeader } from "@/components/page-header"
import { allows } from "@/lib/access"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { formSlugs, formTitle, isFormSlug, type FormKind } from "@/lib/documents/form-model"
import { loadDocumentCatalog } from "@/lib/documents/queries"
import { loadFormDraft } from "@/lib/documents/form-queries"
import { getAccess } from "@/lib/permissions"

export default async function NewFormDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ kind: slug }, query, access] = await Promise.all([params, searchParams, getAccess()])
  if (!isFormSlug(slug)) notFound()
  if (!access || access.status === "deactivated") redirect("/login")
  const kind = formSlugs[slug]
  if (!canAdd(access, kind)) redirect("/no-access")
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const [loaded, margins, origin, catalog] = await Promise.all([
    loadFormDraft(kind, null, {
      po: first(query.po),
      project: first(query.project),
      payment: first(query.payment),
      expense: first(query.expense),
      line: first(query.line),
      client: first(query.client),
    }),
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
  return (
    <FormStudio
      draft={loaded.draft}
      employees={catalog.employees}
      origin={origin}
      margins={margins}
      canSave
    />
  )
}

function canAdd(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>, kind: FormKind) {
  if (kind === "delivery_challan") return allows(access, "purchase_orders", "add") || allows(access, "projects", "add")
  if (kind === "payment_voucher") return allows(access, "vendor_payments", "add") || allows(access, "expenses", "add")
  if (kind === "salary_slip") return allows(access, "payroll", "add")
  if (kind === "letter") return allows(access, "projects", "add") || allows(access, "clients", "add")
  return allows(access, "projects", "add")
}
