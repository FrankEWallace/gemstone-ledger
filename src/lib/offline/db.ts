import Dexie, { type Table } from "dexie";

// ─── Key-Value store for React Query cache persistence ───────────────────────
export interface KVEntry {
  key: string;
  value: string;
}

// ─── Sync queue for Phase 2 (offline mutations) ──────────────────────────────
export interface SyncQueueItem {
  id?: number; // auto-increment PK
  entity: string; // e.g. "safety_incidents"
  operation: "create" | "update" | "delete";
  payload: unknown;
  siteId: string;
  timestamp: number;
  retries: number;
}

// ─── Cached entity shapes (mirrors Supabase row types, kept flat) ─────────────
export interface CachedSafetyIncident {
  id: string;
  site_id: string;
  title: string;
  severity: string | null;
  type: string | null;
  description: string | null;
  actions_taken: string | null;
  reported_by: string | null;
  reported_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface CachedInventoryItem {
  id: string;
  site_id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  reorder_level: number | null;
  created_at: string;
}

export interface CachedTransaction {
  id: string;
  site_id: string;
  type: "income" | "expense";
  category: string | null;
  description: string | null;
  unit_price: number;
  quantity: number;
  transaction_date: string;
  created_at: string;
}

export interface CachedEquipment {
  id: string;
  site_id: string;
  name: string;
  type: string | null;
  status: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  created_at: string;
}

export interface CachedWorker {
  id: string;
  site_id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
}

export interface CachedShiftRecord {
  id: string;
  site_id: string;
  worker_id: string | null;
  shift_date: string;
  hours_worked: number | null;
  output_amount: number | null;
  notes: string | null;
  created_at: string;
}

export interface CachedSupplier {
  id: string;
  site_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
}

export interface CachedNotification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string | null;
  read: boolean;
  created_at: string;
}

// ─── Sync log (Phase 3) ───────────────────────────────────────────────────────
export interface SyncLogEntry {
  id?: number;           // auto-increment PK
  entity: string;        // e.g. "safety_incidents"
  operation: "create" | "update" | "delete";
  status: "success" | "failed" | "conflict";
  conflictResolution?: "server_wins" | "client_wins";
  error?: string;
  syncedAt: number;      // epoch ms
}

// ─── Database class ───────────────────────────────────────────────────────────
class MiningOfflineDB extends Dexie {
  kv_store!: Table<KVEntry, string>;
  sync_queue!: Table<SyncQueueItem, number>;
  sync_log!: Table<SyncLogEntry, number>;
  safety_incidents!: Table<CachedSafetyIncident, string>;
  inventory_items!: Table<CachedInventoryItem, string>;
  transactions!: Table<CachedTransaction, string>;
  equipment!: Table<CachedEquipment, string>;
  workers!: Table<CachedWorker, string>;
  shift_records!: Table<CachedShiftRecord, string>;
  suppliers!: Table<CachedSupplier, string>;
  notifications!: Table<CachedNotification, string>;

  constructor() {
    super("fw-mining-os");

    this.version(1).stores({
      kv_store: "key",
      sync_queue: "++id, entity, operation, siteId, timestamp",
      safety_incidents: "id, site_id, severity, resolved_at, created_at",
      inventory_items: "id, site_id, category, created_at",
      transactions: "id, site_id, type, category, transaction_date",
      equipment: "id, site_id, status, created_at",
      workers: "id, site_id, role, status",
      shift_records: "id, site_id, worker_id, shift_date",
      suppliers: "id, site_id, status",
      notifications: "id, user_id, read, created_at",
    });

    // Version 2 — add sync_log table
    this.version(2).stores({
      kv_store: "key",
      sync_queue: "++id, entity, operation, siteId, timestamp",
      sync_log: "++id, entity, status, syncedAt",
      safety_incidents: "id, site_id, severity, resolved_at, created_at",
      inventory_items: "id, site_id, category, created_at",
      transactions: "id, site_id, type, category, transaction_date",
      equipment: "id, site_id, status, created_at",
      workers: "id, site_id, role, status",
      shift_records: "id, site_id, worker_id, shift_date",
      suppliers: "id, site_id, status",
      notifications: "id, user_id, read, created_at",
    });
  }
}

export const offlineDB = new MiningOfflineDB();
