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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          entity_type: string
          field: string
          id: string
          last_triggered_at: string | null
          name: string
          notification_body: string | null
          notification_title: string
          operator: string
          site_id: string
          threshold: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          entity_type: string
          field: string
          id?: string
          last_triggered_at?: string | null
          name: string
          notification_body?: string | null
          notification_title: string
          operator: string
          site_id: string
          threshold: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          entity_type?: string
          field?: string
          id?: string
          last_triggered_at?: string | null
          name?: string
          notification_body?: string | null
          notification_title?: string
          operator?: string
          site_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          site_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          site_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          org_id: string
          start_date: string | null
          status: string
          target_sites: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          org_id: string
          start_date?: string | null
          status?: string
          target_sites?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          org_id?: string
          start_date?: string | null
          status?: string
          target_sites?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          type: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          type?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          daily_rate: number | null
          id: string
          name: string
          notes: string | null
          org_id: string
          site_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          daily_rate?: number | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          site_id: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          daily_rate?: number | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          site_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          created_at: string
          id: string
          last_service_date: string | null
          name: string
          next_service_date: string | null
          notes: string | null
          serial_number: string | null
          site_id: string
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_service_date?: string | null
          name: string
          next_service_date?: string | null
          notes?: string | null
          serial_number?: string | null
          site_id: string
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_service_date?: string | null
          name?: string
          next_service_date?: string | null
          notes?: string | null
          serial_number?: string | null
          site_id?: string
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          integration_type: string
          org_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_type: string
          org_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_type?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          quantity: number
          reorder_level: number | null
          site_id: string
          sku: string | null
          supplier_id: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          quantity?: number
          reorder_level?: number | null
          site_id: string
          sku?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          reorder_level?: number | null
          site_id?: string
          sku?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_write_offs: {
        Row: {
          id: string
          site_id: string
          inventory_item_id: string
          quantity: number
          reason: string
          notes: string | null
          written_off_at: string
          written_off_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          inventory_item_id: string
          quantity: number
          reason: string
          notes?: string | null
          written_off_at?: string
          written_off_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          inventory_item_id?: string
          quantity?: number
          reason?: string
          notes?: string | null
          written_off_at?: string
          written_off_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_write_offs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_write_offs_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_uptime_pct: number | null
          expense_budget: number | null
          id: string
          month: string
          ore_tonnes_target: number | null
          revenue_target: number | null
          shift_target: number | null
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_uptime_pct?: number | null
          expense_budget?: number | null
          id?: string
          month: string
          ore_tonnes_target?: number | null
          revenue_target?: number | null
          shift_target?: number | null
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_uptime_pct?: number | null
          expense_budget?: number | null
          id?: string
          month?: string
          ore_tonnes_target?: number | null
          revenue_target?: number | null
          shift_target?: number | null
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          sender_id: string | null
          site_id: string
        }
        Insert: {
          channel?: string
          content: string
          created_at?: string
          id?: string
          sender_id?: string | null
          site_id: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string | null
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          inventory_item_id: string | null
          order_id: string
          quantity: number
          total: number | null
          unit_price: number
        }
        Insert: {
          id?: string
          inventory_item_id?: string | null
          order_id: string
          quantity: number
          total?: number | null
          unit_price: number
        }
        Update: {
          id?: string
          inventory_item_id?: string | null
          order_id?: string
          quantity?: number
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_number: string | null
          received_date: string | null
          site_id: string
          status: string
          supplier_id: string | null
          total_amount: number | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          received_date?: string | null
          site_id: string
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string | null
          received_date?: string | null
          site_id?: string
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          disabled_modules: Json
          id: string
          logo_url: string | null
          name: string
          slug: string
          weekly_report_email: string | null
          weekly_report_enabled: boolean
        }
        Insert: {
          created_at?: string
          disabled_modules?: Json
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          weekly_report_email?: string | null
          weekly_report_enabled?: boolean
        }
        Update: {
          created_at?: string
          disabled_modules?: Json
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          weekly_report_email?: string | null
          weekly_report_enabled?: boolean
        }
        Relationships: []
      }
      planned_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          notes: string | null
          shift_date: string
          site_id: string
          start_time: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          notes?: string | null
          shift_date: string
          site_id: string
          start_time: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          shift_date?: string
          site_id?: string
          start_time?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_shifts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planned_shifts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          created_by: string | null
          grade_g_t: number | null
          id: string
          log_date: string
          notes: string | null
          ore_tonnes: number | null
          site_id: string
          updated_at: string
          waste_tonnes: number | null
          water_m3: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grade_g_t?: number | null
          id?: string
          log_date: string
          notes?: string | null
          ore_tonnes?: number | null
          site_id: string
          updated_at?: string
          waste_tonnes?: number | null
          water_m3?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grade_g_t?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          ore_tonnes?: number | null
          site_id?: string
          updated_at?: string
          waste_tonnes?: number | null
          water_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_incidents: {
        Row: {
          actions_taken: string | null
          created_at: string
          description: string | null
          id: string
          reported_by: string | null
          resolved_at: string | null
          severity: string
          site_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          actions_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          site_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          actions_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string
          site_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_records: {
        Row: {
          created_at: string
          hours_worked: number | null
          id: string
          metric_unit: string | null
          notes: string | null
          output_metric: number | null
          shift_date: string
          site_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          hours_worked?: number | null
          id?: string
          metric_unit?: string | null
          notes?: string | null
          output_metric?: number | null
          shift_date: string
          site_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          hours_worked?: number | null
          id?: string
          metric_unit?: string | null
          notes?: string | null
          output_metric?: number | null
          shift_date?: string
          site_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_records_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_records_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_documents: {
        Row: {
          category: string | null
          created_at: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          site_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          site_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          site_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_documents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          org_id: string
          status: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          org_id: string
          status?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          org_id?: string
          status?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          status: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          description: string | null
          expense_category_id: string | null
          id: string
          inventory_item_id: string | null
          quantity: number
          reference_no: string | null
          site_id: string
          source: string | null
          status: string
          transaction_date: string
          type: string
          unit_price: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          description?: string | null
          expense_category_id?: string | null
          id?: string
          inventory_item_id?: string | null
          quantity?: number
          reference_no?: string | null
          site_id: string
          source?: string | null
          status?: string
          transaction_date?: string
          type: string
          unit_price?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          description?: string | null
          expense_category_id?: string | null
          id?: string
          inventory_item_id?: string | null
          quantity?: number
          reference_no?: string | null
          site_id?: string
          source?: string | null
          status?: string
          transaction_date?: string
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarding_completed: boolean
          org_id: string | null
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          org_id?: string | null
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          org_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_site_roles: {
        Row: {
          id: string
          role: string
          site_id: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          site_id: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_site_roles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_site_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          department: string | null
          full_name: string
          hire_date: string | null
          id: string
          position: string | null
          site_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          position?: string | null
          site_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          position?: string | null
          site_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accessible_site_ids: { Args: never; Returns: string[] }
      current_org_id: { Args: never; Returns: string }
      handle_invited_user_signup: {
        Args: { p_full_name: string; p_user_id: string }
        Returns: undefined
      }
      handle_new_user_signup: {
        Args: {
          p_full_name: string
          p_org_name: string
          p_org_slug: string
          p_user_id: string
        }
        Returns: undefined
      }
      has_site_access: { Args: { site_id: string }; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      is_site_manager: { Args: { site_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Convenience row-type aliases
export type InventoryItem      = Database["public"]["Tables"]["inventory_items"]["Row"]
export type InventoryWriteOff  = Database["public"]["Tables"]["inventory_write_offs"]["Row"]
export type Transaction        = Database["public"]["Tables"]["transactions"]["Row"]
export type TransactionType    = Transaction["type"]
export type TransactionStatus  = Transaction["status"]
export type Customer           = Database["public"]["Tables"]["customers"]["Row"]
A new version of Supabase CLI is available: v2.95.4 (currently installed v2.90.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
