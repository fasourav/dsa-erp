export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          lifespan_years: number
          name: string
          notes: string | null
          purchase_date: string
          quantity: number
          total_cost: number | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          lifespan_years: number
          name: string
          notes?: string | null
          purchase_date: string
          quantity?: number
          total_cost?: number | null
          unit_cost: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          lifespan_years?: number
          name?: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          total_cost?: number | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["bank_flow_direction"]
          id: string
          income_id: string | null
          notes: string | null
          operational_expense_id: string | null
          payment_method: string | null
          project_id: string | null
          source_kind: Database["public"]["Enums"]["bank_source_kind"]
          transaction_date: string
          vat_tax_payment_id: string | null
          vendor_payment_id: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["bank_flow_direction"]
          id?: string
          income_id?: string | null
          notes?: string | null
          operational_expense_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          source_kind: Database["public"]["Enums"]["bank_source_kind"]
          transaction_date?: string
          vat_tax_payment_id?: string | null
          vendor_payment_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["bank_flow_direction"]
          id?: string
          income_id?: string | null
          notes?: string | null
          operational_expense_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          source_kind?: Database["public"]["Enums"]["bank_source_kind"]
          transaction_date?: string
          vat_tax_payment_id?: string | null
          vendor_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: true
            referencedRelation: "client_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: true
            referencedRelation: "income"
            referencedColumns: ["income_id"]
          },
          {
            foreignKeyName: "bank_transactions_operational_expense_id_fkey"
            columns: ["operational_expense_id"]
            isOneToOne: true
            referencedRelation: "operational_expense_details"
            referencedColumns: ["operational_expense_id"]
          },
          {
            foreignKeyName: "bank_transactions_operational_expense_id_fkey"
            columns: ["operational_expense_id"]
            isOneToOne: true
            referencedRelation: "operational_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_vat_tax_payment_id_fkey"
            columns: ["vat_tax_payment_id"]
            isOneToOne: true
            referencedRelation: "vat_tax_by_project"
            referencedColumns: ["vat_tax_id"]
          },
          {
            foreignKeyName: "bank_transactions_vat_tax_payment_id_fkey"
            columns: ["vat_tax_payment_id"]
            isOneToOne: true
            referencedRelation: "vat_tax_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_vendor_payment_id_fkey"
            columns: ["vendor_payment_id"]
            isOneToOne: true
            referencedRelation: "project_expenses"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "bank_transactions_vendor_payment_id_fkey"
            columns: ["vendor_payment_id"]
            isOneToOne: true
            referencedRelation: "vendor_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          allocated_budget: number
          created_at: string
          department_id: string
          id: string
          notes: string | null
          period_month: number
          period_year: number
        }
        Insert: {
          allocated_budget: number
          created_at?: string
          department_id: string
          id?: string
          notes?: string | null
          period_month: number
          period_year: number
        }
        Update: {
          allocated_budget?: number
          created_at?: string
          department_id?: string
          id?: string
          notes?: string | null
          period_month?: number
          period_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "budget_vs_actual"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "budgets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          due_on: string | null
          id: string
          issued_on: string
          project_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          description?: string | null
          due_on?: string | null
          id?: string
          issued_on?: string
          project_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          due_on?: string | null
          id?: string
          issued_on?: string
          project_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_summaries"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payments: {
        Row: {
          amount: number
          bank_account_id: string
          client_invoice_id: string
          created_at: string
          id: string
          method: string | null
          notes: string | null
          paid_on: string
          reference: string | null
          remarks: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          client_invoice_id: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          reference?: string | null
          remarks?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          client_invoice_id?: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          reference?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_client_invoice_id_fkey"
            columns: ["client_invoice_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_client_invoice_id_fkey"
            columns: ["client_invoice_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_client_invoice_id_fkey"
            columns: ["client_invoice_id"]
            isOneToOne: false
            referencedRelation: "client_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payments_client_invoice_id_fkey"
            columns: ["client_invoice_id"]
            isOneToOne: false
            referencedRelation: "income"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      clients: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["party_kind"]
          notes: string | null
          person_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind: Database["public"]["Enums"]["party_kind"]
          notes?: string | null
          person_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["party_kind"]
          notes?: string | null
          person_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          joining_date: string
          leave_date: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          joining_date: string
          leave_date?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          joining_date?: string
          leave_date?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "budget_vs_actual"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          converted_client_id: string | null
          converted_project_id: string | null
          created_at: string
          current_stage: string | null
          email: string | null
          estimated_value: number | null
          id: string
          kind: Database["public"]["Enums"]["party_kind"]
          lead_name: string
          notes: string | null
          phone: string | null
          probability: number | null
          project_details: string | null
          project_type: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          converted_client_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          current_stage?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          kind: Database["public"]["Enums"]["party_kind"]
          lead_name: string
          notes?: string | null
          phone?: string | null
          probability?: number | null
          project_details?: string | null
          project_type?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          converted_client_id?: string | null
          converted_project_id?: string | null
          created_at?: string
          current_stage?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["party_kind"]
          lead_name?: string
          notes?: string | null
          phone?: string | null
          probability?: number | null
          project_details?: string | null
          project_type?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "client_summaries"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      office_expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      operational_expenses: {
        Row: {
          amount: number
          bank_account_id: string
          category: string
          created_at: string
          department_id: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          project_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          bank_account_id: string
          category: string
          created_at?: string
          department_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string
          category?: string
          created_at?: string
          department_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          project_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "budget_vs_actual"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "operational_expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "operational_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "operational_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "operational_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_aging"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "operational_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "operational_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_summaries"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "operational_expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      payroll_lines: {
        Row: {
          allowance: number
          basic_salary: number
          bonus: number
          created_at: string
          deductions: number
          employee_id: string
          id: string
          net_salary: number | null
          notes: string | null
          payroll_run_id: string
        }
        Insert: {
          allowance?: number
          basic_salary?: number
          bonus?: number
          created_at?: string
          deductions?: number
          employee_id: string
          id?: string
          net_salary?: number | null
          notes?: string | null
          payroll_run_id: string
        }
        Update: {
          allowance?: number
          basic_salary?: number
          bonus?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          id?: string
          net_salary?: number | null
          notes?: string | null
          payroll_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          paid_on: string | null
          period_month: number
          period_year: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          paid_on?: string | null
          period_month: number
          period_year: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          paid_on?: string | null
          period_month?: number
          period_year?: number
          status?: string
        }
        Relationships: []
      }
      project_expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      project_types: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          completed_on: string | null
          created_at: string
          current_phase: string | null
          details: string | null
          id: string
          lead_id: string | null
          location: string | null
          name: string
          project_type: string | null
          started_on: string
          status: Database["public"]["Enums"]["project_status"]
          total_value: number
          updated_at: string
          year: number | null
        }
        Insert: {
          client_id: string
          completed_on?: string | null
          created_at?: string
          current_phase?: string | null
          details?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          name: string
          project_type?: string | null
          started_on?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_value?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          client_id?: string
          completed_on?: string | null
          created_at?: string
          current_phase?: string | null
          details?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          name?: string
          project_type?: string | null
          started_on?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_value?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_summaries"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_pipeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_tax_payments: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          id: string
          notes: string | null
          paid_on: string
          payment_method: string | null
          project_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_on?: string
          payment_method?: string | null
          project_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_on?: string
          payment_method?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vat_tax_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vat_tax_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vat_tax_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vat_tax_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_on: string | null
          id: string
          issued_on: string
          purchase_order_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_on?: string | null
          id?: string
          issued_on?: string
          purchase_order_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_on?: string | null
          id?: string
          issued_on?: string
          purchase_order_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_aging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_aging"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "vendor_po_balances"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "vendor_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "vendor_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          expense_category: string | null
          id: string
          method: string | null
          notes: string | null
          paid_on: string
          reference: string | null
          vendor_invoice_id: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          expense_category?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          reference?: string | null
          vendor_invoice_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          expense_category?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          reference?: string | null
          vendor_invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_invoice_id_fkey"
            columns: ["vendor_invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_purchase_orders: {
        Row: {
          created_at: string
          id: string
          issued_on: string
          notes: string | null
          project_id: string
          total_value: number
          updated_at: string
          vendor_id: string
          work_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issued_on?: string
          notes?: string | null
          project_id: string
          total_value?: number
          updated_at?: string
          vendor_id: string
          work_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issued_on?: string
          notes?: string | null
          project_id?: string
          total_value?: number
          updated_at?: string
          vendor_id?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_aging"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_summaries"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_work_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      vendors: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["vendor_kind"]
          notes: string | null
          person_name: string | null
          phone: string | null
          updated_at: string
          vendor_field: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind: Database["public"]["Enums"]["vendor_kind"]
          notes?: string | null
          person_name?: string | null
          phone?: string | null
          updated_at?: string
          vendor_field?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["vendor_kind"]
          notes?: string | null
          person_name?: string | null
          phone?: string | null
          updated_at?: string
          vendor_field?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      accounts_payable: {
        Row: {
          created_at: string | null
          current_status: Database["public"]["Enums"]["payment_status"] | null
          due_date: string | null
          id: string | null
          issued_on: string | null
          pending_payable: number | null
          project_id: string | null
          project_name: string | null
          purchase_order_id: string | null
          total_paid: number | null
          total_payable: number | null
          vendor_field: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_payable_aging: {
        Row: {
          aging_bucket: string | null
          created_at: string | null
          current_status: Database["public"]["Enums"]["payment_status"] | null
          days_past_due: number | null
          due_date: string | null
          id: string | null
          issued_on: string | null
          pending_payable: number | null
          project_id: string | null
          project_name: string | null
          purchase_order_id: string | null
          total_paid: number | null
          total_payable: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          billed_amount: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          current_status: Database["public"]["Enums"]["payment_status"] | null
          due: number | null
          due_date: string | null
          id: string | null
          issued_on: string | null
          paid: number | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_aging: {
        Row: {
          aging_bucket: string | null
          billed_amount: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          current_status: Database["public"]["Enums"]["payment_status"] | null
          days_past_due: number | null
          due: number | null
          due_date: string | null
          id: string | null
          issued_on: string | null
          paid: number | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_aging_summary: {
        Row: {
          aging_bucket: string | null
          amount_pending: number | null
          invoice_count: number | null
        }
        Relationships: []
      }
      ar_aging_summary: {
        Row: {
          aging_bucket: string | null
          amount_due: number | null
          invoice_count: number | null
        }
        Relationships: []
      }
      asset_register: {
        Row: {
          asset_id: string | null
          category: string | null
          created_at: string | null
          current_value: number | null
          lifespan_months: number | null
          lifespan_years: number | null
          monthly_depreciation: number | null
          months_used: number | null
          name: string | null
          notes: string | null
          purchase_date: string | null
          quantity: number | null
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          asset_id?: string | null
          category?: string | null
          created_at?: string | null
          current_value?: never
          lifespan_months?: never
          lifespan_years?: number | null
          monthly_depreciation?: never
          months_used?: never
          name?: string | null
          notes?: string | null
          purchase_date?: string | null
          quantity?: number | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          asset_id?: string | null
          category?: string | null
          created_at?: string | null
          current_value?: never
          lifespan_months?: never
          lifespan_years?: number | null
          monthly_depreciation?: never
          months_used?: never
          name?: string | null
          notes?: string | null
          purchase_date?: string | null
          quantity?: number | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: []
      }
      bank_transaction_details: {
        Row: {
          amount: number | null
          bank_account_name: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["bank_flow_direction"] | null
          id: string | null
          income_id: string | null
          notes: string | null
          operational_expense_id: string | null
          payment_method: string | null
          project_id: string | null
          project_name: string | null
          source_kind: Database["public"]["Enums"]["bank_source_kind"] | null
          transaction_date: string | null
          vat_tax_payment_id: string | null
          vendor_payment_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: true
            referencedRelation: "client_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: true
            referencedRelation: "income"
            referencedColumns: ["income_id"]
          },
          {
            foreignKeyName: "bank_transactions_operational_expense_id_fkey"
            columns: ["operational_expense_id"]
            isOneToOne: true
            referencedRelation: "operational_expense_details"
            referencedColumns: ["operational_expense_id"]
          },
          {
            foreignKeyName: "bank_transactions_operational_expense_id_fkey"
            columns: ["operational_expense_id"]
            isOneToOne: true
            referencedRelation: "operational_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "bank_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_vat_tax_payment_id_fkey"
            columns: ["vat_tax_payment_id"]
            isOneToOne: true
            referencedRelation: "vat_tax_by_project"
            referencedColumns: ["vat_tax_id"]
          },
          {
            foreignKeyName: "bank_transactions_vat_tax_payment_id_fkey"
            columns: ["vat_tax_payment_id"]
            isOneToOne: true
            referencedRelation: "vat_tax_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_vendor_payment_id_fkey"
            columns: ["vendor_payment_id"]
            isOneToOne: true
            referencedRelation: "project_expenses"
            referencedColumns: ["expense_id"]
          },
          {
            foreignKeyName: "bank_transactions_vendor_payment_id_fkey"
            columns: ["vendor_payment_id"]
            isOneToOne: true
            referencedRelation: "vendor_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_vs_actual: {
        Row: {
          actual_spent: number | null
          allocated_budget: number | null
          budget_id: string | null
          department: string | null
          department_id: string | null
          period_month: number | null
          period_year: number | null
          variance: number | null
        }
        Relationships: []
      }
      client_summaries: {
        Row: {
          client_id: string | null
          completed_projects: number | null
          display_name: string | null
          kind: Database["public"]["Enums"]["party_kind"] | null
          ongoing_projects: number | null
          total_paid: number | null
          total_pending: number | null
          total_project_value: number | null
        }
        Relationships: []
      }
      employee_details: {
        Row: {
          active_months: number | null
          created_at: string | null
          department: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          joining_date: string | null
          leave_date: string | null
          notes: string | null
          phone: string | null
        }
        Insert: {
          active_months?: never
          created_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          joining_date?: string | null
          leave_date?: string | null
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active_months?: never
          created_at?: string | null
          department?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          joining_date?: string | null
          leave_date?: string | null
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      income: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string | null
          income_id: string | null
          invoice_id: string | null
          paid_on: string | null
          payment_method: string | null
          project_id: string | null
          project_name: string | null
          reference: string | null
          remarks: string | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_summaries"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "client_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pipeline: {
        Row: {
          converted_client_id: string | null
          converted_project_id: string | null
          created_at: string | null
          current_stage: string | null
          email: string | null
          estimated_value: number | null
          kind: Database["public"]["Enums"]["party_kind"] | null
          lead_id: string | null
          lead_name: string | null
          phone: string | null
          probability: number | null
          project_details: string | null
          project_type: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          weighted_value: number | null
        }
        Insert: {
          converted_client_id?: string | null
          converted_project_id?: string | null
          created_at?: string | null
          current_stage?: string | null
          email?: string | null
          estimated_value?: number | null
          kind?: Database["public"]["Enums"]["party_kind"] | null
          lead_id?: string | null
          lead_name?: string | null
          phone?: string | null
          probability?: number | null
          project_details?: string | null
          project_type?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          weighted_value?: never
        }
        Update: {
          converted_client_id?: string | null
          converted_project_id?: string | null
          created_at?: string | null
          current_stage?: string | null
          email?: string | null
          estimated_value?: number | null
          kind?: Database["public"]["Enums"]["party_kind"] | null
          lead_id?: string | null
          lead_name?: string | null
          phone?: string | null
          probability?: number | null
          project_details?: string | null
          project_type?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          weighted_value?: never
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "client_summaries"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "leads_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_cashflow: {
        Row: {
          cash_in_income: number | null
          cash_out_expense: number | null
          cash_out_operational: number | null
          cash_out_payroll: number | null
          cash_out_total: number | null
          net_cashflow: number | null
          period_month: number | null
          period_year: number | null
        }
        Relationships: []
      }
      operational_expense_details: {
        Row: {
          category: string | null
          created_at: string | null
          expense_date: string | null
          notes: string | null
          operational_expense_id: string | null
          payment_method: string | null
          project_id: string | null
          project_name: string | null
          total_expense: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "operational_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "operational_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_backlogs: {
        Row: {
          backlog_amount: number | null
          client_name: string | null
          project_id: string | null
          project_name: string | null
          project_value: number | null
        }
        Relationships: []
      }
      project_expenses: {
        Row: {
          created_at: string | null
          expense_category: string | null
          expense_date: string | null
          expense_id: string | null
          notes: string | null
          payment_method: string | null
          po_id: string | null
          project_id: string | null
          project_name: string | null
          reference: string | null
          total_expense: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_financials: {
        Row: {
          backlog_amount: number | null
          client_id: string | null
          expense_due: number | null
          expense_total: number | null
          gross_profit: number | null
          project_id: string | null
          project_name: string | null
          total_paid: number | null
          total_pending_due: number | null
          total_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_aging"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_summaries"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_tax_by_project: {
        Row: {
          created_at: string | null
          notes: string | null
          paid_on: string | null
          payment_method: string | null
          project_id: string | null
          project_name: string | null
          vat_tax_id: string | null
          vat_tax_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vat_tax_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vat_tax_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vat_tax_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_po_balances: {
        Row: {
          project_id: string | null
          purchase_order_id: string | null
          total_paid: number | null
          total_pending: number | null
          total_value: number | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_backlogs"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_financials"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_aging"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "project_expenses"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_summaries"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_summaries: {
        Row: {
          display_name: string | null
          kind: Database["public"]["Enums"]["vendor_kind"] | null
          total_due: number | null
          total_paid: number | null
          total_po_value: number | null
          vendor_field: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      resolve_bank_account_id: { Args: { preferred: string }; Returns: string }
    }
    Enums: {
      bank_flow_direction: "inflow" | "outflow"
      bank_source_kind:
        | "project_income"
        | "vendor_expense"
        | "operational_expense"
        | "vat_tax"
        | "other"
      invoice_direction: "receivable" | "payable"
      lead_status: "open" | "won" | "lost" | "on_hold"
      party_kind: "person" | "company"
      payment_status: "unpaid" | "partial" | "paid" | "void"
      project_status: "active" | "completed"
      vendor_kind: "private" | "company"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      bank_flow_direction: ["inflow", "outflow"],
      bank_source_kind: [
        "project_income",
        "vendor_expense",
        "operational_expense",
        "vat_tax",
        "other",
      ],
      invoice_direction: ["receivable", "payable"],
      lead_status: ["open", "won", "lost", "on_hold"],
      party_kind: ["person", "company"],
      payment_status: ["unpaid", "partial", "paid", "void"],
      project_status: ["active", "completed"],
      vendor_kind: ["private", "company"],
    },
  },
} as const
