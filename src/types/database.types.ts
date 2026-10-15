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
      asset_categories: {
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
      assets: {
        Row: {
          category_id: string | null
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
          category_id?: string | null
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
          category_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          opening_balance: number
          routing_number: string | null
          sort_order: number
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
          routing_number?: string | null
          sort_order?: number
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          address?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          routing_number?: string | null
          sort_order?: number
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
          payroll_line_id: string | null
          project_id: string | null
          source_kind: Database["public"]["Enums"]["bank_source_kind"]
          transaction_date: string
          transfer_id: string | null
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
          payroll_line_id?: string | null
          project_id?: string | null
          source_kind: Database["public"]["Enums"]["bank_source_kind"]
          transaction_date?: string
          transfer_id?: string | null
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
          payroll_line_id?: string | null
          project_id?: string | null
          source_kind?: Database["public"]["Enums"]["bank_source_kind"]
          transaction_date?: string
          transfer_id?: string | null
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
            foreignKeyName: "bank_transactions_payroll_line_id_fkey"
            columns: ["payroll_line_id"]
            isOneToOne: true
            referencedRelation: "payroll_lines"
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
      bank_transfers: {
        Row: {
          amount: number
          created_at: string
          from_account_id: string
          id: string
          notes: string | null
          payment_method: string | null
          to_account_id: string
          transfer_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_account_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          to_account_id: string
          transfer_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_account_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          to_account_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
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
          address: string | null
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
          address?: string | null
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
          address?: string | null
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
      company_settings: {
        Row: {
          fiscal_year_start_month: number
          id: boolean
          launch_date: string
          print_margin_bottom_mm: number
          print_margin_top_mm: number
          updated_at: string
        }
        Insert: {
          fiscal_year_start_month?: number
          id?: boolean
          launch_date?: string
          print_margin_bottom_mm?: number
          print_margin_top_mm?: number
          updated_at?: string
        }
        Update: {
          fiscal_year_start_month?: number
          id?: boolean
          launch_date?: string
          print_margin_bottom_mm?: number
          print_margin_top_mm?: number
          updated_at?: string
        }
        Relationships: []
      }
      issued_documents: {
        Row: {
          body: Json
          client_invoice_id: string | null
          client_payment_id: string | null
          created_at: string
          document_no: string
          id: string
          issued_on: string
          kind: string
          purchase_order_id: string | null
          status: string
          total: number
          updated_at: string
          verify_token: string
        }
        Insert: {
          body?: Json
          client_invoice_id?: string | null
          client_payment_id?: string | null
          created_at?: string
          document_no: string
          id?: string
          issued_on: string
          kind: string
          purchase_order_id?: string | null
          status: string
          total: number
          updated_at?: string
          verify_token: string
        }
        Update: {
          body?: Json
          client_invoice_id?: string | null
          client_payment_id?: string | null
          created_at?: string
          document_no?: string
          id?: string
          issued_on?: string
          kind?: string
          purchase_order_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          verify_token?: string
        }
        Relationships: []
      }
      quotation_lines: {
        Row: {
          id: string
          item: string
          quantity: number | null
          quotation_id: string
          section_name: string
          sort_order: number
          specification: string
          unit: string
          unit_price: number | null
        }
        Insert: {
          id?: string
          item: string
          quantity?: number | null
          quotation_id: string
          section_name?: string
          sort_order: number
          specification?: string
          unit?: string
          unit_price?: number | null
        }
        Update: {
          id?: string
          item?: string
          quantity?: number | null
          quotation_id?: string
          section_name?: string
          sort_order?: number
          specification?: string
          unit?: string
          unit_price?: number | null
        }
        Relationships: []
      }
      quotation_milestones: {
        Row: {
          id: string
          label: string
          percent: number
          quotation_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          percent: number
          quotation_id: string
          sort_order: number
        }
        Update: {
          id?: string
          label?: string
          percent?: number
          quotation_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      quotations: {
        Row: {
          ait_percent: number
          area: string
          authorized_by: string
          client_id: string
          created_at: string
          document_no: string
          exclusions: string
          id: string
          issued_on: string
          prepared_by: string
          project_id: string | null
          status: string
          subject: string
          terms: string
          total: number
          updated_at: string
          valid_until: string | null
          verify_token: string
        }
        Insert: {
          ait_percent?: number
          area?: string
          authorized_by?: string
          client_id: string
          created_at?: string
          document_no: string
          exclusions?: string
          id?: string
          issued_on: string
          prepared_by?: string
          project_id?: string | null
          status?: string
          subject?: string
          terms?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          verify_token: string
        }
        Update: {
          ait_percent?: number
          area?: string
          authorized_by?: string
          client_id?: string
          created_at?: string
          document_no?: string
          exclusions?: string
          id?: string
          issued_on?: string
          prepared_by?: string
          project_id?: string | null
          status?: string
          subject?: string
          terms?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          verify_token?: string
        }
        Relationships: []
      }
      work_order_lines: {
        Row: {
          id: string
          item: string
          quantity: number | null
          section_name: string
          sort_order: number
          specification: string
          unit: string
          unit_price: number | null
          work_order_id: string
        }
        Insert: {
          id?: string
          item: string
          quantity?: number | null
          section_name?: string
          sort_order: number
          specification?: string
          unit?: string
          unit_price?: number | null
          work_order_id: string
        }
        Update: {
          id?: string
          item?: string
          quantity?: number | null
          section_name?: string
          sort_order?: number
          specification?: string
          unit?: string
          unit_price?: number | null
          work_order_id?: string
        }
        Relationships: []
      }
      work_order_milestones: {
        Row: {
          id: string
          label: string
          percent: number
          sort_order: number
          work_order_id: string
        }
        Insert: {
          id?: string
          label: string
          percent: number
          sort_order: number
          work_order_id: string
        }
        Update: {
          id?: string
          label?: string
          percent?: number
          sort_order?: number
          work_order_id?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          authorized_by: string
          created_at: string
          document_no: string
          id: string
          introduction: string
          issued_on: string
          prepared_by: string
          project_id: string | null
          purchase_order_id: string | null
          proposal_on: string | null
          status: string
          subject: string
          terms: string
          total: number
          updated_at: string
          vendor_id: string
          verify_token: string
          work_end: string | null
          work_start: string | null
        }
        Insert: {
          authorized_by?: string
          created_at?: string
          document_no: string
          id?: string
          introduction?: string
          issued_on: string
          prepared_by?: string
          project_id?: string | null
          purchase_order_id?: string | null
          proposal_on?: string | null
          status?: string
          subject?: string
          terms?: string
          total?: number
          updated_at?: string
          vendor_id: string
          verify_token: string
          work_end?: string | null
          work_start?: string | null
        }
        Update: {
          authorized_by?: string
          created_at?: string
          document_no?: string
          id?: string
          introduction?: string
          issued_on?: string
          prepared_by?: string
          project_id?: string | null
          purchase_order_id?: string | null
          proposal_on?: string | null
          status?: string
          subject?: string
          terms?: string
          total?: number
          updated_at?: string
          vendor_id?: string
          verify_token?: string
          work_end?: string | null
          work_start?: string | null
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
          allowance: number
          created_at: string
          department_id: string | null
          designation: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          joining_date: string
          leave_date: string | null
          monthly_salary: number
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          allowance?: number
          created_at?: string
          department_id?: string | null
          designation?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          joining_date: string
          leave_date?: string | null
          monthly_salary: number
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          allowance?: number
          created_at?: string
          department_id?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          joining_date?: string
          leave_date?: string | null
          monthly_salary?: number
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
      lead_sources: {
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
      lead_stages: {
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
      lead_statuses: {
        Row: {
          code: string
          created_at: string
          id: string
          is_open: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_open?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_open?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      lead_types: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          added_on: string
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
          project_name: string | null
          project_type: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_on?: string
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
          project_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_on?: string
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
          project_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["code"]
          },
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
          bank_account_id: string | null
          created_at: string
          id: string
          notes: string | null
          paid_on: string | null
          payment_method: string | null
          period_month: number
          period_year: number
          status: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_on?: string | null
          payment_method?: string | null
          period_month: number
          period_year: number
          status?: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_on?: string | null
          payment_method?: string | null
          period_month?: number
          period_year?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_modules: {
        Row: {
          key: string
          label: string
          owners_only: boolean
          sort_order: number
        }
        Insert: {
          key: string
          label: string
          owners_only?: boolean
          sort_order: number
        }
        Update: {
          key?: string
          label?: string
          owners_only?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          designation: string | null
          display_name: string | null
          email: string | null
          id: string
          last_sign_in_at: string | null
          role: string
          show_financials: boolean
          status: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          last_sign_in_at?: string | null
          role?: string
          show_financials?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_sign_in_at?: string | null
          role?: string
          show_financials?: boolean
          status?: string
        }
        Relationships: []
      }
      role_template_permissions: {
        Row: {
          can_add: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module: string
          template_id: string
        }
        Insert: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          module: string
          template_id: string
        }
        Update: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          module?: string
          template_id?: string
        }
        Relationships: []
      }
      role_templates: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          show_financials: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          show_financials?: boolean
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          show_financials?: boolean
          sort_order?: number
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
      project_milestones: {
        Row: {
          amount: number | null
          created_at: string
          done_on: string | null
          due_on: string | null
          id: string
          label: string
          percent_of_value: number | null
          project_id: string
          stage_id: string | null
          updated_at: string
          work_order_milestone_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          done_on?: string | null
          due_on?: string | null
          id?: string
          label: string
          percent_of_value?: number | null
          project_id: string
          stage_id?: string | null
          updated_at?: string
          work_order_milestone_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          done_on?: string | null
          due_on?: string | null
          id?: string
          label?: string
          percent_of_value?: number | null
          project_id?: string
          stage_id?: string | null
          updated_at?: string
          work_order_milestone_id?: string | null
        }
        Relationships: []
      }
      project_stage_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order: number
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      project_stages: {
        Row: {
          created_at: string
          done_on: string | null
          id: string
          name: string
          notes: string
          planned_end: string | null
          planned_start: string | null
          project_id: string
          sort_order: number
          status: Database["public"]["Enums"]["project_stage_status"]
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          done_on?: string | null
          id?: string
          name: string
          notes?: string
          planned_end?: string | null
          planned_start?: string | null
          project_id: string
          sort_order: number
          status?: Database["public"]["Enums"]["project_stage_status"]
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          done_on?: string | null
          id?: string
          name?: string
          notes?: string
          planned_end?: string | null
          planned_start?: string | null
          project_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["project_stage_status"]
          updated_at?: string
          weight?: number
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
          progress_percent: number
          project_type: string | null
          recovery_plan: string | null
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
          progress_percent?: number
          project_type?: string | null
          recovery_plan?: string | null
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
          progress_percent?: number
          project_type?: string | null
          recovery_plan?: string | null
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
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
          address: string | null
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
          address?: string | null
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
          address?: string | null
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
      user_invites: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          role: string
          show_financials: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          role: string
          show_financials?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          role?: string
          show_financials?: boolean
        }
        Relationships: []
      }
      record_attachments: {
        Row: {
          byte_size: number
          content_type: string
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          parent_id: string
          parent_type: string
          storage_path: string
        }
        Insert: {
          byte_size: number
          content_type: string
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          parent_id: string
          parent_type: string
          storage_path: string
        }
        Update: {
          byte_size?: number
          content_type?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          parent_id?: string
          parent_type?: string
          storage_path?: string
        }
        Relationships: []
      }
      bank_match_tolerances: {
        Row: {
          days: number
          label: string
          sort_order: number
        }
        Insert: {
          days: number
          label: string
          sort_order: number
        }
        Update: {
          days?: number
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      bank_statement_lines: {
        Row: {
          amount: number
          bank_account_id: string
          bank_transaction_id: string | null
          created_at: string
          created_by: string | null
          description: string
          direction: string
          id: string
          line_date: string
          reference: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          direction: string
          id?: string
          line_date: string
          reference?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          bank_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          direction?: string
          id?: string
          line_date?: string
          reference?: string
        }
        Relationships: []
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          book_balance: number
          difference: number
          id: string
          period_end: string
          period_start: string
          reconciled_at: string
          reconciled_by: string | null
          statement_balance: number
        }
        Insert: {
          bank_account_id: string
          book_balance?: number
          difference?: number
          id?: string
          period_end: string
          period_start: string
          reconciled_at?: string
          reconciled_by?: string | null
          statement_balance: number
        }
        Update: {
          bank_account_id?: string
          book_balance?: number
          difference?: number
          id?: string
          period_end?: string
          period_start?: string
          reconciled_at?: string
          reconciled_by?: string | null
          statement_balance?: number
        }
        Relationships: []
      }
    }
    Views: {
      bank_accounts_readable: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          address: string | null
          bank_name: string | null
          created_at: string | null
          currency: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          opening_balance: number | null
          routing_number: string | null
          sort_order: number | null
        }
        Relationships: []
      }
      bank_transactions_readable: {
        Row: {
          amount: number | null
          bank_account_id: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["bank_flow_direction"] | null
          id: string | null
          income_id: string | null
          notes: string | null
          operational_expense_id: string | null
          payment_method: string | null
          payroll_line_id: string | null
          project_id: string | null
          source_kind: Database["public"]["Enums"]["bank_source_kind"] | null
          transaction_date: string | null
          transfer_id: string | null
          vat_tax_payment_id: string | null
          vendor_payment_id: string | null
        }
        Relationships: []
      }
      employees_readable: {
        Row: {
          allowance: number | null
          created_at: string | null
          department: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          joining_date: string | null
          leave_date: string | null
          monthly_salary: number | null
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Relationships: []
      }
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
          work_type: string | null
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
          gross_profit: number | null
          gross_profit_pct: number | null
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
          project_name: string | null
          project_type: string | null
          source: string | null
          status: string | null
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
          project_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string | null
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
          project_name?: string | null
          project_type?: string | null
          source?: string | null
          status?: string | null
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
          expense_total: number | null
          project_id: string | null
          project_name: string | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          project_value: number | null
          recovery_plan: string | null
          total_paid: number | null
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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          module: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          record_label: string | null
          summary: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          module: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_label?: string | null
          summary: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_label?: string | null
          summary?: string
          table_name?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_add: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module: string
          user_id: string
        }
        Insert: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          module: string
          user_id: string
        }
        Update: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          module?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Functions: {
      dashboard_feed: { Args: never; Returns: Json }
      dashboard_scope: { Args: { p_year: number | null }; Returns: Json }
      auto_match_bank_statement: {
        Args: { p_account: string; p_from: string; p_to: string; p_days: number }
        Returns: number
      }
      verify_business_document: {
        Args: { p_token: string }
        Returns: {
          document_no: string | null
          issued_on: string | null
          outcome: string
          status: string | null
          total: number | null
        }[]
      }
      resolve_bank_account_id: { Args: { preferred: string }; Returns: string }
      search_records: {
        Args: { query: string }
        Returns: {
          module_key: string
          module_label: string
          record_id: string
          label: string
          detail: string
        }[]
      }
      set_own_display_name: { Args: { next_name: string }; Returns: undefined }
      save_business_document: {
        Args: {
          p_fields: Json
          p_id?: string
          p_kind: string
          p_lines: Json
          p_milestones: Json
          p_version?: string
        }
        Returns: Json
      }
      financial_report: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      vendor_statement: {
        Args: { p_vendor_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      client_statement: {
        Args: {
          p_client_id: string
          p_from: string
          p_to: string
          p_project_id?: string
        }
        Returns: Json
      }
      record_backup: { Args: { p_kind: string }; Returns: undefined }
      claim_attachment_file_purges: {
        Args: { p_limit?: number }
        Returns: { path: string }[]
      }
      settle_attachment_file_purges: { Args: { p_paths: string[] }; Returns: number }
      sweep_orphan_attachments: { Args: never; Returns: number }
      purge_document_verify_hits: { Args: never; Returns: number }
    }
    Enums: {
      bank_flow_direction: "inflow" | "outflow"
      bank_source_kind:
        | "project_income"
        | "vendor_expense"
        | "operational_expense"
        | "vat_tax"
        | "other"
        | "payroll"
        | "transfer"
        | "deposit"
        | "withdrawal"
      party_kind: "person" | "company"
      payment_status: "unpaid" | "partial" | "paid" | "void"
      project_stage_status: "Not Started" | "In Progress" | "Done"
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
        "payroll",
        "transfer",
        "deposit",
        "withdrawal",
      ],
      party_kind: ["person", "company"],
      payment_status: ["unpaid", "partial", "paid", "void"],
      project_stage_status: ["Not Started", "In Progress", "Done"],
      project_status: ["active", "completed"],
      vendor_kind: ["private", "company"],
    },
  },
} as const
