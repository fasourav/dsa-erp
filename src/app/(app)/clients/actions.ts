"use server"

import { revalidatePath } from "next/cache"

import type { ClientKind } from "@/lib/client-summary"
import {
  escapeLikePattern,
  hasMinDigits,
  isValidEmail,
} from "@/lib/client-validation"
import { createClient } from "@/lib/supabase/server"

const clientIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DeleteClientResult = {
  error: string | null
}

export type ClientFormInput = {
  kind: ClientKind
  name: string
  email: string
  phone: string
  notes: string
}

export type ClientFormFieldErrors = {
  name?: string
  email?: string
  phone?: string
}

export type ClientFormResult = {
  error: string | null
  fieldErrors?: ClientFormFieldErrors
}

export async function addClient(
  input: ClientFormInput,
): Promise<ClientFormResult> {
  return saveClient(null, input)
}

export async function updateClient(
  id: string,
  input: ClientFormInput,
): Promise<ClientFormResult> {
  if (!clientIdPattern.test(id)) {
    return { error: "That client could not be found." }
  }

  return saveClient(id, input)
}

async function saveClient(
  id: string | null,
  input: ClientFormInput,
): Promise<ClientFormResult> {
  const { kind } = input

  if (kind !== "person" && kind !== "company") {
    return { error: "Choose Individual or Company." }
  }

  const name = input.name.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()
  const notes = input.notes.trim()

  if (!name) {
    return {
      error: null,
      fieldErrors: {
        name:
          kind === "company"
            ? "Enter the company name."
            : "Enter the client's name.",
      },
    }
  }

  if (email && !isValidEmail(email)) {
    return {
      error: null,
      fieldErrors: { email: "Enter a valid email address." },
    }
  }

  if (phone && !hasMinDigits(phone, 11)) {
    return {
      error: null,
      fieldErrors: {
        phone: "Enter a phone number with at least 11 digits.",
      },
    }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  if (email) {
    let emailQuery = supabase
      .from("clients")
      .select("id")
      .ilike("email", escapeLikePattern(email))
      .limit(1)

    if (id) {
      emailQuery = emailQuery.neq("id", id)
    }

    const { data: emailMatches, error: emailLookupError } = await emailQuery

    if (emailLookupError) {
      return { error: "Could not save this client." }
    }

    if (emailMatches && emailMatches.length > 0) {
      return {
        error: null,
        fieldErrors: { email: "A client with this email already exists." },
      }
    }
  }

  const values = {
    kind,
    person_name: kind === "person" ? name : null,
    company_name: kind === "company" ? name : null,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase.from("clients").update(values).eq("id", id).select("id")
    : await supabase.from("clients").insert(values).select("id")

  if (error) {
    if (error.code === "23505") {
      return {
        error: null,
        fieldErrors: {
          name: "A client with this name and phone already exists.",
        },
      }
    }

    return { error: "Could not save this client." }
  }

  if (!data || data.length === 0) {
    return { error: "That client could not be found." }
  }

  revalidatePath("/clients")
  return { error: null }
}

export async function deleteClient(id: string): Promise<DeleteClientResult> {
  if (!clientIdPattern.test(id)) {
    return { error: "That client could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error:
          "This client is linked to projects or invoices and cannot be deleted.",
      }
    }

    return { error: "Could not delete this client." }
  }

  if (!data || data.length === 0) {
    return { error: "That client could not be found." }
  }

  revalidatePath("/clients")
  return { error: null }
}
