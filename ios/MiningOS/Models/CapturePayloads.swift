import Foundation

// Payload structs mirror the exact Supabase column names, so property names use
// snake_case deliberately (default JSONEncoder emits keys verbatim, and columns
// like `grade_g_t` don't survive automatic camelCase->snake_case conversion).
// Optional fields that are nil are omitted from the JSON, letting DB defaults apply.

struct ProductionLogPayload: Encodable {
    var site_id: String
    var log_date: String        // "yyyy-MM-dd"
    var ore_tonnes: Double?
    var waste_tonnes: Double?
    var grade_g_t: Double?
    var water_m3: Double?
    var notes: String?
}

struct TransactionPayload: Encodable {
    var site_id: String
    var type: String             // "income" | "expense" | "refund"
    var status: String           // "success" | "pending" | "refunded" | "cancelled"
    var quantity: Double
    var unit_price: Double        // amount = quantity * unit_price
    var transaction_date: String  // "yyyy-MM-dd"
    var description: String?
    var category: String?
    var currency: String?
    var customer_id: String?      // FK -> customers.id
    var phase_id: String?         // FK -> production_phases.id
    var reference_no: String?
    var inventory_item_id: String?    // FK -> inventory_items.id (set for item usage)
    var source: String?               // "inventory" marks an item-usage expense (web convention)
    var expense_category_id: String?  // FK -> expense_categories.id (income or expense kind)
}

/// New structured category. `type` is "income" or "expense" (DB check constraint).
/// Org-scoped; client `id` for offline-safe optimistic select, mirroring customers/phases.
struct ExpenseCategoryCreatePayload: Encodable {
    var id: String
    var org_id: String
    var name: String
    var type: String
}

/// Partial update to an inventory item's price. `id` targets the row; the outbox
/// UPDATE path filters by it. Mirrors the web `updateInventoryItem({ unit_cost })`.
struct InventoryPriceUpdate: Encodable {
    var id: String
    var unit_cost: Double
}

/// Partial update to on-hand stock. Absolute new quantity (read-modify-write, same
/// as the web app's `consumeInventoryItem` — a stale read can clobber a concurrent edit).
struct InventoryStockUpdate: Encodable {
    var id: String
    var quantity: Double
}

/// New customer. `id` is generated client-side (UUID) so the just-created row can
/// be selected on a transaction immediately, before the outbox syncs. `org_id` is
/// required (NOT NULL, no DB default); RLS additionally requires site-manager.
struct CustomerCreatePayload: Encodable {
    var id: String
    var site_id: String
    var org_id: String
    var name: String
    var type: String              // "external" | "internal"
    var status: String            // "active" | "inactive" | "completed"
    var contact_phone: String?
    var daily_rate: Double?
    var contract_start: String?   // "yyyy-MM-dd"
    var contract_end: String?
    var notes: String?
}

/// New production phase (Awamu). Client-generated `id`; `org_id` required.
struct PhaseCreatePayload: Encodable {
    var id: String
    var site_id: String
    var org_id: String
    var name: String
    var status: String            // "open" | "closed"
    var start_date: String?       // "yyyy-MM-dd"
}

struct InventoryItemPayload: Encodable {
    var id: String? = nil      // optional client UUID for offline-safe optimistic insert
    var site_id: String
    var name: String
    var quantity: Double
    var category: String?
    var sku: String?
    var unit: String?
    var unit_cost: Double?
    var reorder_level: Double?
}

struct SafetyIncidentPayload: Encodable {
    var site_id: String
    var title: String
    var severity: String?
    var type: String?
    var description: String?
    var actions_taken: String?
    var resolution_status: String?  // "open" | "under_review" | "resolved"
}
