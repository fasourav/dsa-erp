import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Plus } from "lucide-react"

import { documentExportGrid, DocumentList } from "@/components/documents/document-list"
import { ListExport } from "@/components/list-export"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { allows } from "@/lib/access"
import { formTitle, formSlugs, isFormSlug, type FormKind } from "@/lib/documents/form-model"
import { listFormDocuments } from "@/lib/documents/form-queries"
import { getAccess } from "@/lib/permissions"

export default async function FormDocumentsPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: slug } = await params
  if (!isFormSlug(slug)) notFound()
  const kind = formSlugs[slug]
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!canSee(access, kind)) redirect("/no-access")
  const page = await listFormDocuments(kind)
  const canAdd = canWrite(access, kind)

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title={formTitle(kind)}
        description="Same page in the preview, the downloaded PDF, and the print file."
        actions={
          <>
            <ListExport grid={documentExportGrid(page.items, slug, formTitle(kind))} />
            {canAdd ? (
              <Button nativeButton={false} render={<Link href={`/documents/${slug}/new`} />}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New
              </Button>
            ) : null}
          </>
        }
      />
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList items={page.items} hrefBase={`/documents/${slug}`} empty="No Documents Yet." pagingLabel="Documents pagination" />
    </div>
  )
}

function canSee(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>, kind: FormKind) {
  if (kind === "delivery_challan") return allows(access, "purchase_orders", "view") || allows(access, "projects", "view")
  if (kind === "payment_voucher") return allows(access, "vendor_payments", "view") || allows(access, "expenses", "view")
  if (kind === "salary_slip") return allows(access, "payroll", "view")
  if (kind === "letter") return allows(access, "projects", "view") || allows(access, "clients", "view")
  return allows(access, "projects", "view")
}

function canWrite(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>, kind: FormKind) {
  if (kind === "delivery_challan") return allows(access, "purchase_orders", "add") || allows(access, "projects", "add")
  if (kind === "payment_voucher") return allows(access, "vendor_payments", "add") || allows(access, "expenses", "add")
  if (kind === "salary_slip") return allows(access, "payroll", "add")
  if (kind === "letter") return allows(access, "projects", "add") || allows(access, "clients", "add")
  return allows(access, "projects", "add")
}
