"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import {
  recoveryPlanError,
  recoveryPlanValue,
} from "@/lib/recovery-plan"
import { createClient } from "@/lib/supabase/server"

export type RecoveryPlanFieldErrors = {
  recoveryPlan?: string
}

export type RecoveryPlanResult = {
  error: string | null
  fieldErrors?: RecoveryPlanFieldErrors
}

export async function saveRecoveryPlan(
  projectId: string,
  recoveryPlan: string,
): Promise<RecoveryPlanResult> {
  if (!isUuid(projectId)) {
    return { error: "That project could not be found." }
  }

  const wordError = recoveryPlanError(recoveryPlan)
  if (wordError) {
    return { error: null, fieldErrors: { recoveryPlan: wordError } }
  }

  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ recovery_plan: recoveryPlanValue(recoveryPlan) })
    .eq("id", projectId)
    .select("id")

  if (error) {
    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { recoveryPlan: "Use 150 words or fewer." },
      }
    }

    if (error.code === "42703") {
      return {
        error:
          "Recovery Plan is not available yet. Apply the backlog migration.",
      }
    }

    return { error: "Could not save this recovery plan." }
  }

  if (!data || data.length === 0) {
    return { error: "That project could not be found." }
  }

  revalidatePath("/backlog")
  return { error: null }
}
