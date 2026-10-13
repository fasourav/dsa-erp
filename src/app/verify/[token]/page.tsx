import { headers } from "next/headers"

import { allowVerifyRequest, verifyClientKey } from "@/lib/documents/guard"
import { formatIsoDate, formatMoney, toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Verify document",
  robots: { index: false, follow: false },
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const headerList = await headers()
  if (!allowVerifyRequest(verifyClientKey(headerList))) {
    return <VerifyMessage title="Too many checks" detail="Try again shortly." />
  }

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return <VerifyMessage title="Not verified" detail="This document could not be verified." />
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("verify_business_document", { p_token: token })
  const row = data?.[0]

  if (row?.outcome === "limited") {
    return <VerifyMessage title="Too many checks" detail="Try again shortly." />
  }

  if (error || !row || row.outcome !== "ok" || !row.document_no || !row.issued_on || !row.status) {
    return <VerifyMessage title="Not verified" detail="This document could not be verified." />
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-medium tracking-tight">Document check</h1>
      <dl className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
        <Fact label="Document number" value={row.document_no} />
        <Fact label="Date" value={formatIsoDate(row.issued_on.slice(0, 10))} />
        <Fact label="Total" value={formatMoney(toNumber(row.total))} />
        <Fact label="Status" value={row.status} />
      </dl>
    </main>
  )
}

function VerifyMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-3 px-4 py-10">
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
