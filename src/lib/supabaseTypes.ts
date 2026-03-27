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
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          created_at?: string;
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
        };
        Insert: {
          id: string;
          org_id?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
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
