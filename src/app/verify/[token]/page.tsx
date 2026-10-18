import { headers } from "next/headers"
import type { ReactNode } from "react"

import { AuthStage } from "@/app/login/auth-stage"
import { Money } from "@/components/money"
import { allowVerifyRequest, verifyClientKey } from "@/lib/documents/guard"
import { formatIsoDate, toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Verify Document",
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
    return <VerifyMessage title="Too Many Checks" detail="Try again shortly." />
  }

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return <VerifyMessage title="Not Verified" detail="This document could not be verified." />
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("verify_business_document", { p_token: token })
  const row = data?.[0]

  if (row?.outcome === "limited") {
    return <VerifyMessage title="Too Many Checks" detail="Try again shortly." />
  }

  if (error || !row || row.outcome !== "ok" || !row.document_no || !row.issued_on || !row.status) {
    return <VerifyMessage title="Not Verified" detail="This document could not be verified." />
  }

  return (
    <AuthStage title="Document Check" description="This document matches a saved record.">
      <dl className="flex flex-col">
        <Fact label="Document number" value={row.document_no} />
        <Fact label="Date" value={formatIsoDate(row.issued_on.slice(0, 10))} />
        <Fact label="Total" value={<Money className="text-foreground" value={toNumber(row.total)} />} />
        <Fact label="Status" value={row.status} />
      </dl>
    </AuthStage>
  )
}

function VerifyMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <AuthStage title={title} description={detail}>
      {null}
    </AuthStage>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="text-right text-ui font-semibold text-foreground">{value}</dd>
    </div>
  )
}
