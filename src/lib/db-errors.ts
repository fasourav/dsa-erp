import { formatMoney } from "@/lib/format"

export type DbError = {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
}

export function errorText(error: DbError | null | undefined): string {
  return error?.message ?? ""
}

export function isCheckViolation(error: DbError | null | undefined): boolean {
  return error?.code === "23514" || /check constraint/i.test(errorText(error))
}

export function isUniqueViolation(error: DbError | null | undefined): boolean {
  return error?.code === "23505" || /duplicate key/i.test(errorText(error))
}

export function isForeignKeyViolation(error: DbError | null | undefined): boolean {
  return error?.code === "23503" || /foreign key/i.test(errorText(error))
}

export function mentions(error: DbError | null | undefined, text: string): boolean {
  return errorText(error).toLowerCase().includes(text.toLowerCase())
}

export function insufficientBalanceMessage(
  accountName: string,
  available: number,
  needed: number,
): string {
  const name = accountName.trim() || "this account"
  return `Insufficient balance in ${name}: ${formatMoney(available)} available, ${formatMoney(needed)} needed.`
}

const constraintMessages: Record<string, { message: string; field?: string }> = {
  clients_display_name_ci: {
    message: "A client with this name already exists.",
    field: "name",
  },
  clients_unique_name_phone: {
    message: "A client with this name already exists.",
    field: "name",
  },
  clients_unique_name_without_phone: {
    message: "A client with this name already exists.",
    field: "name",
  },
  vendors_display_name_ci: {
    message: "A vendor with this name already exists.",
    field: "name",
  },
  bank_accounts_name_ci: {
    message: "A bank account with this name already exists.",
    field: "name",
  },
  budgets_department_id_period_year_period_month_key: {
    message: "A budget for this department and month already exists.",
    field: "departmentId",
  },
  document_templates_kind_name_key: {
    message: "A template with this name already exists for that document kind.",
    field: "name",
  },
  document_templates_payload_check: {
    message: "Lines need a description, unit, quantity, and rate. Milestone percents must total 100.",
    field: "milestones",
  },
  project_budget_lines_project_category_key: {
    message: "This project already has a budget line for that category.",
    field: "categoryId",
  },
  payroll_runs_period_year_period_month_key: {
    message: "Salaries for this month are already paid.",
    field: "month",
  },
  employees_employee_code_key: {
    message: "That employee code is already in use.",
    field: "employeeCode",
  },
  employees_leave_after_join: {
    message: "Leave date cannot be before the joining date.",
    field: "leaveDate",
  },
  projects_started_on_launch: {
    message: "Use a date on or after 01 Jan 2021.",
    field: "startedOn",
  },
  leads_added_on_launch: {
    message: "Use a date on or after 01 Jan 2021.",
    field: "addedOn",
  },
  projects_total_value_check: {
    message: "Enter an amount greater than 0.",
    field: "totalValue",
  },
  vendor_purchase_orders_total_value_check: {
    message: "Enter an amount greater than 0.",
    field: "totalValue",
  },
  budgets_period_year_check: {
    message: "Enter a year from 2021 onward.",
    field: "periodYear",
  },
  leads_email_format: {
    message: "Enter a valid email address.",
    field: "email",
  },
  leads_phone_digits: {
    message: "Enter a phone number with at least 11 digits.",
    field: "phone",
  },
  assets_quantity_check: {
    message: "Enter a whole quantity of at least 1.",
    field: "quantity",
  },
  client_payments_client_invoice_id_fkey: {
    message: "This invoice has payments and cannot be deleted.",
  },
  vendor_payments_vendor_invoice_id_fkey: {
    message: "This invoice has payments and cannot be deleted.",
  },
  departments_name_key: {
    message: "An item with this name already exists.",
    field: "name",
  },
  departments_name_ci: {
    message: "An item with this name already exists.",
    field: "name",
  },
  project_types_name_key: {
    message: "An item with this name already exists.",
    field: "name",
  },
  project_types_name_ci: {
    message: "An item with this name already exists.",
    field: "name",
  },
  project_phases_name_key: {
    message: "An item with this name already exists.",
    field: "name",
  },
  project_phases_name_ci: {
    message: "An item with this name already exists.",
    field: "name",
  },
  office_expense_categories_report_group_check: {
    message: "Choose a report group.",
    field: "reportGroup",
  },
  office_expense_categories_name_key: {
    message: "An item with this name already exists.",
    field: "name",
  },
  office_expense_categories_name_ci: {
    message: "An item with this name already exists.",
    field: "name",
  },
  project_expense_categories_name_key: {
    message: "An item with this name already exists.",
    field: "name",
  },
  project_expense_categories_name_ci: {
    message: "An item with this name already exists.",
    field: "name",
  },
  payment_methods_name_key: {
    message: "An item with this name already exists.",
    field: "name",
  },
  payment_methods_name_ci: {
    message: "An item with this name already exists.",
    field: "name",
  },
}

export type DbIssue = {
  message: string
  field: string | null
}

export function dbIssue(error: DbError | null | undefined): DbIssue | null {
  if (!error) return null

  const balance = balanceIssue(error)
  if (balance) return balance

  if (/operational purchase order/i.test(errorText(error))) {
    return {
      message:
        "Vendor costs go through an Operational Purchase Order, then a vendor bill and a vendor payment.",
      field: null,
    }
  }

  const name = constraintName(error)
  if (name && constraintMessages[name]) {
    const known = constraintMessages[name]
    return { message: known.message, field: known.field ?? null }
  }

  const raised = raisedMessage(error)
  if (raised) return { message: raised, field: null }

  if (isUniqueViolation(error)) {
    return { message: "A record with these values already exists.", field: null }
  }

  if (isForeignKeyViolation(error)) {
    const text = `${error.message ?? ""} ${error.details ?? ""}`
    if (/update or delete|still referenced|restrict/i.test(text)) {
      return { message: "This record is in use and cannot be deleted.", field: null }
    }
    return { message: "Choose a value that still exists.", field: null }
  }

  if (isCheckViolation(error)) {
    return { message: "This value is not allowed.", field: null }
  }

  return null
}

export function friendlyDbError(
  error: DbError | null | undefined,
  fallback: string,
): string {
  return dbIssue(error)?.message ?? fallback
}

function balanceIssue(error: DbError): DbIssue | null {
  if (error.message === "INSUFFICIENT_BALANCE") {
    const name = error.details?.trim() || "this account"
    const [availableText, neededText] = (error.hint ?? "").split(",")
    const available = Number(availableText)
    const needed = Number(neededText)
    if (availableText && neededText && Number.isFinite(available) && Number.isFinite(needed)) {
      return {
        message: insufficientBalanceMessage(name, available, needed),
        field: "bankAccountId",
      }
    }
    return { message: `Insufficient balance in ${name}.`, field: "bankAccountId" }
  }

  if (/bank balance negative/i.test(error.message ?? "")) {
    return {
      message: "This would make the bank balance negative.",
      field: "bankAccountId",
    }
  }

  return null
}

function constraintName(error: DbError): string | null {
  const text = `${error.message ?? ""} ${error.details ?? ""}`
  const match = /constraint "([^"]+)"/.exec(text)
  return match?.[1] ?? null
}

function raisedMessage(error: DbError): string | null {
  const message = error.message?.trim() ?? ""
  if (!message || message.length > 240) return null
  if (
    /violates|duplicate key|syntax error|permission denied|stack|SQLSTATE|relation "|column "|deadlock|could not|schema cache/i.test(
      message,
    )
  ) {
    return null
  }
  if (message === "INSUFFICIENT_BALANCE") return null
  return message
}
