import { toNumber } from "@/lib/format"
import { isMissingReportFunction } from "@/lib/reports/parse"
import {
  buildStatementReport,
  partyDisplayName,
  statementPeriodLabel,
  type PartyStatement,
  type StatementLine,
} from "@/lib/statement-report"
import { createClient } from "@/lib/supabase/server"

export {
  buildStatementReport,
  partyDisplayName,
  statementPeriodLabel,
  type PartyStatement,
  type StatementLine,
}

export type StatementLoad =
  | { status: "ok"; statement: PartyStatement }
  | { status: "missing" }
  | { status: "denied" }
  | { status: "error" }

export type ClientProjectOption = {
  id: string
  name: string
}

function text(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function parseStatement(data: unknown): PartyStatement | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const row = data as Record<string, unknown>
  if (row.allowed !== true) return null
  const lines = Array.isArray(row.lines) ? row.lines : []
  return {
    party: text(row.party, "Party"),
    opening: toNumber(row.opening),
    debit: toNumber(row.debit),
    credit: toNumber(row.credit),
    closing: toNumber(row.closing),
    lines: lines.flatMap((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return []
      const line = item as Record<string, unknown>
      const kind = line.kind === "payment" ? "payment" : "bill"
      return [
        {
          id: `${kind}-${text(line.occurred_on, "line")}-${index}`,
          occurredOn: text(line.occurred_on, ""),
          kind,
          reference: text(line.reference, kind === "payment" ? "Payment" : "Bill"),
          project: text(line.project, "—"),
          detail: typeof line.detail === "string" ? line.detail.trim() : "",
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          running: toNumber(line.running),
        },
      ]
    }),
  }
}

function settleStatement(
  data: unknown,
  error: { code?: string; message?: string } | null,
): StatementLoad {
  if (error) {
    if (isMissingReportFunction(error)) return { status: "missing" }
    return { status: "error" }
  }
  const statement = parseStatement(data)
  if (!statement) return { status: "denied" }
  return { status: "ok", statement }
}

export async function loadVendorStatement(
  vendorId: string,
  from: string,
  to: string,
): Promise<StatementLoad> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("vendor_statement", {
    p_vendor_id: vendorId,
    p_from: from,
    p_to: to,
  })
  return settleStatement(data, error)
}

export async function loadClientStatement(
  clientId: string,
  from: string,
  to: string,
  projectId: string | null,
): Promise<StatementLoad> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("client_statement", {
    p_client_id: clientId,
    p_from: from,
    p_to: to,
    ...(projectId ? { p_project_id: projectId } : {}),
  })
  return settleStatement(data, error)
}

export async function getClientProjects(clientId: string): Promise<ClientProjectOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("client_id", clientId)
    .order("name", { ascending: true })
  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name?.trim() || "Project",
  }))
}
