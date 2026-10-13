import Link from "next/link"
import { redirect } from "next/navigation"

import { allows, homePath } from "@/lib/access"
import { documentKinds } from "@/lib/documents/kinds"
import { getAccess } from "@/lib/permissions"

export const metadata = { title: "Documents" }

export default async function DocumentsPage() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  const visible = documentKinds.filter((kind) => allows(access, kind.module, "view"))
  if (visible.length === 0) redirect(homePath(access))

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prepare a printable document. Output is the content only, so it sits on the letterhead pad.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((kind) => (
          <Link
            key={kind.href}
            href={kind.href}
            className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-card p-5 hover:bg-accent"
          >
            <span className="font-medium">{kind.title}</span>
            <span className="text-sm text-muted-foreground">{kind.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
