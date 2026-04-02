// Auto-generated types for FW Mining OS Supabase schema.
// Re-generate after schema changes: supabase gen types typescript --local > src/lib/supabaseTypes.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          created_at: string;
          weekly_report_enabled: boolean;
          weekly_report_email: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          created_at?: string;
          weekly_report_enabled?: boolean;
          weekly_report_email?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          created_at?: string;
          weekly_report_enabled?: boolean;
          weekly_report_email?: string | null;
        };
      };
      sites: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          location: string | null;
          timezone: string;
          status: "active" | "inactive" | "decommissioned";
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          location?: string | null;
          timezone?: string;
          status?: "active" | "inactive" | "decommissioned";
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          location?: string | null;
          timezone?: string;
          status?: "active" | "inactive" | "decommissioned";
          created_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          org_id: string | null;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          onboarding_completed: boolean;
        };
        Insert: {
          id: string;
          org_id?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          onboarding_completed?: boolean;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          onboarding_completed?: boolean;
        };
      };
      user_site_roles: {
        Row: {
          id: string;
          user_id: string;
          site_id: string;
          role: "admin" | "site_manager" | "worker" | "viewer";
        };
        Insert: {
          id?: string;
          user_id: string;
          site_id: string;
          role: "admin" | "site_manager" | "worker" | "viewer";
        };
        Update: {
          id?: string;
          user_id?: string;
          site_id?: string;
          role?: "admin" | "site_manager" | "worker" | "viewer";
        };
      };
      customers: {
        Row: {
          id: string;
          site_id: string;
          org_id: string;
          name: string;
          type: "external" | "internal";
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          contract_start: string | null;
          contract_end: string | null;
          daily_rate: number | null;
          notes: string | null;
          status: "active" | "inactive" | "completed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          org_id: string;
          name: string;
          type?: "external" | "internal";
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contract_start?: string | null;
          contract_end?: string | null;
          daily_rate?: number | null;
          notes?: string | null;
          status?: "active" | "inactive" | "completed";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          org_id?: string;
          name?: string;
          type?: "external" | "internal";
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contract_start?: string | null;
          contract_end?: string | null;
          daily_rate?: number | null;
          notes?: string | null;
          status?: "active" | "inactive" | "completed";
          created_at?: string;
          updated_at?: string;
        };
      };
      expense_categories: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          category: string | null;
          status: "active" | "inactive";
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          category?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          category?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
        };
      };
      inventory_items: {
        Row: {
          id: string;
          site_id: string;
          supplier_id: string | null;
          name: string;
          category: string | null;
          sku: string | null;
          quantity: number;
          unit: string | null;
          unit_cost: number | null;
          reorder_level: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          supplier_id?: string | null;
          name: string;
          category?: string | null;
          sku?: string | null;
          quantity?: number;
          unit?: string | null;
          unit_cost?: number | null;
          reorder_level?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          supplier_id?: string | null;
          name?: string;
          category?: string | null;
          sku?: string | null;
          quantity?: number;
          unit?: string | null;
          unit_cost?: number | null;
          reorder_level?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          site_id: string;
          customer_id: string | null;
          expense_category_id: string | null;
          reference_no: string | null;
          description: string | null;
          category: string | null;
          type: "income" | "expense" | "refund";
          status: "success" | "pending" | "refunded" | "cancelled";
          quantity: number;
          unit_price: number;
          currency: string;
          transaction_date: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          customer_id?: string | null;
          expense_category_id?: string | null;
          reference_no?: string | null;
          description?: string | null;
          category?: string | null;
          type: "income" | "expense" | "refund";
          status?: "success" | "pending" | "refunded" | "cancelled";
          quantity?: number;
          unit_price?: number;
          currency?: string;
          transaction_date?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          customer_id?: string | null;
          expense_category_id?: string | null;
          reference_no?: string | null;
          description?: string | null;
          category?: string | null;
          type?: "income" | "expense" | "refund";
          status?: "success" | "pending" | "refunded" | "cancelled";
          quantity?: number;
          unit_price?: number;
          currency?: string;
          transaction_date?: string;
          created_by?: string | null;
          created_at?: string;
        };
      };
      channels: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          type: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          type?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          type?: string | null;
          description?: string | null;
          created_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          site_id: string;
          supplier_id: string | null;
          channel_id: string | null;
          order_number: string | null;
          status: "draft" | "sent" | "confirmed" | "received" | "cancelled";
          total_amount: number | null;
          expected_date: string | null;
          received_date: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          supplier_id?: string | null;
          channel_id?: string | null;
          order_number?: string | null;
          status?: "draft" | "sent" | "confirmed" | "received" | "cancelled";
          total_amount?: number | null;
          expected_date?: string | null;
          received_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          supplier_id?: string | null;
          channel_id?: string | null;
          order_number?: string | null;
          status?: "draft" | "sent" | "confirmed" | "received" | "cancelled";
          total_amount?: number | null;
          expected_date?: string | null;
          received_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          inventory_item_id: string | null;
          quantity: number;
          unit_price: number;
          total: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          inventory_item_id?: string | null;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          inventory_item_id?: string | null;
          quantity?: number;
          unit_price?: number;
        };
      };
      workers: {
        Row: {
          id: string;
          site_id: string;
          user_id: string | null;
          full_name: string;
          position: string | null;
          department: string | null;
          hire_date: string | null;
          status: "active" | "on_leave" | "terminated";
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          user_id?: string | null;
          full_name: string;
          position?: string | null;
          department?: string | null;
          hire_date?: string | null;
          status?: "active" | "on_leave" | "terminated";
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          user_id?: string | null;
          full_name?: string;
          position?: string | null;
          department?: string | null;
          hire_date?: string | null;
          status?: "active" | "on_leave" | "terminated";
          created_at?: string;
        };
      };
      shift_records: {
        Row: {
          id: string;
          worker_id: string;
          site_id: string;
          shift_date: string;
          hours_worked: number | null;
          output_metric: number | null;
          metric_unit: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          site_id: string;
          shift_date: string;
          hours_worked?: number | null;
          output_metric?: number | null;
          metric_unit?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          site_id?: string;
          shift_date?: string;
          hours_worked?: number | null;
          output_metric?: number | null;
          metric_unit?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          site_id: string;
          sender_id: string | null;
          content: string;
          channel: "general" | "safety" | "operations";
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          sender_id?: string | null;
          content: string;
          channel?: "general" | "safety" | "operations";
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          sender_id?: string | null;
          content?: string;
          channel?: "general" | "safety" | "operations";
          created_at?: string;
        };
      };
      campaigns: {
        Row: {
          id: string;
          org_id: string;
          title: string;
          description: string | null;
          status: "draft" | "active" | "completed" | "cancelled";
          start_date: string | null;
          end_date: string | null;
          target_sites: string[] | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          title: string;
          description?: string | null;
          status?: "draft" | "active" | "completed" | "cancelled";
          start_date?: string | null;
          end_date?: string | null;
          target_sites?: string[] | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          title?: string;
          description?: string | null;
          status?: "draft" | "active" | "completed" | "cancelled";
          start_date?: string | null;
          end_date?: string | null;
          target_sites?: string[] | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          body: string | null;
          type: "info" | "alert" | "warning";
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          body?: string | null;
          type?: "info" | "alert" | "warning";
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          body?: string | null;
          type?: "info" | "alert" | "warning";
          read?: boolean;
          created_at?: string;
        };
      };
      equipment: {
        Row: {
          id: string;
          site_id: string;
          name: string;
          type: string | null;
          serial_number: string | null;
          status: "operational" | "maintenance" | "retired";
          last_service_date: string | null;
          next_service_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          name: string;
          type?: string | null;
          serial_number?: string | null;
          status?: "operational" | "maintenance" | "retired";
          last_service_date?: string | null;
          next_service_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          name?: string;
          type?: string | null;
          serial_number?: string | null;
          status?: "operational" | "maintenance" | "retired";
          last_service_date?: string | null;
          next_service_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      safety_incidents: {
        Row: {
          id: string;
          site_id: string;
          reported_by: string | null;
          severity: "low" | "medium" | "high" | "critical";
          type: "near-miss" | "injury" | "equipment" | "environmental" | "other";
          title: string;
          description: string | null;
          actions_taken: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          reported_by?: string | null;
          severity?: "low" | "medium" | "high" | "critical";
          type?: "near-miss" | "injury" | "equipment" | "environmental" | "other";
          title: string;
          description?: string | null;
          actions_taken?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          reported_by?: string | null;
          severity?: "low" | "medium" | "high" | "critical";
          type?: "near-miss" | "injury" | "equipment" | "environmental" | "other";
          title?: string;
          description?: string | null;
          actions_taken?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      planned_shifts: {
        Row: {
          id: string;
          site_id: string;
          worker_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          worker_id: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          worker_id?: string;
          shift_date?: string;
          start_time?: string;
          end_time?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      site_documents: {
        Row: {
          id: string;
          site_id: string;
          uploaded_by: string | null;
          name: string;
          category: string | null;
          storage_path: string;
          file_size: number | null;
          mime_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          uploaded_by?: string | null;
          name: string;
          category?: string | null;
          storage_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          uploaded_by?: string | null;
          name?: string;
          category?: string | null;
          storage_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
          created_at?: string;
        };
      };
      integration_configs: {
        Row: {
          id: string;
          org_id: string;
          integration_type: string;
          config: Json;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          integration_type: string;
          config?: Json;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          integration_type?: string;
          config?: Json;
          enabled?: boolean;
          created_at?: string;
        };
      };
    };
    Functions: {
      current_org_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      accessible_site_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
    };
  };
}

// Convenience row types
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Site = Database["public"]["Tables"]["sites"]["Row"];
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type UserSiteRole = Database["public"]["Tables"]["user_site_roles"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerType = Customer["type"];
export type CustomerStatus = Customer["status"];
export type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type Worker = Database["public"]["Tables"]["workers"]["Row"];
export type ShiftRecord = Database["public"]["Tables"]["shift_records"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type IntegrationConfig = Database["public"]["Tables"]["integration_configs"]["Row"];

export type UserRole = UserSiteRole["role"];
export type SiteStatus = Site["status"];
export type TransactionType = Transaction["type"];
export type TransactionStatus = Transaction["status"];
export type OrderStatus = Order["status"];
export type WorkerStatus = Worker["status"];
export type MessageChannel = Message["channel"];
export type CampaignStatus = Campaign["status"];
export type NotificationType = Notification["type"];
export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type EquipmentStatus = Equipment["status"];
export type SafetyIncident = Database["public"]["Tables"]["safety_incidents"]["Row"];
export type IncidentSeverity = SafetyIncident["severity"];
export type IncidentType = SafetyIncident["type"];
export type PlannedShift = Database["public"]["Tables"]["planned_shifts"]["Row"];
export type SiteDocument = Database["public"]["Tables"]["site_documents"]["Row"];

// ── Phase 8 types ─────────────────────────────────────────────────────────────
export interface KpiTarget {
  id: string;
  site_id: string;
  month: string;               // YYYY-MM-DD (first of month)
  revenue_target: number | null;
  expense_budget: number | null;
  shift_target: number | null;
  equipment_uptime_pct: number | null;
  ore_tonnes_target: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionLog {
  id: string;
  site_id: string;
  log_date: string;
  ore_tonnes: number | null;
  waste_tonnes: number | null;
  grade_g_t: number | null;
  water_m3: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Audit log (not in DB type generator — defined manually) ───────────────────
export interface AuditLog {
  id: string;
  site_id: string | null;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: "create" | "update" | "delete";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// ── Customer summary report type ───────────────────────────────────────────────
export interface CustomerSummary {
  customerId: string;
  customerName: string;
  customerType: "external" | "internal";
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  expensesByCategory: { category: string; total: number }[];
}
