import Foundation
import Supabase

/// Lightweight decodables + read helpers that feed the Entry Pad pickers.
/// These are the app's first *reads* from Supabase (capture is otherwise
/// write-only). All are site-scoped; RLS + the explicit site filter keep them
/// tenant-safe.

struct CustomerLite: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
}

struct PhaseLite: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let status: String?

    var isOpen: Bool { (status ?? "open") == "open" }
}

/// A Cost Catalog row. `unitCost` is the current (volatile) price; `quantity` is
/// on-hand stock. Mirrors the web app's `inventory_items`, which is site-scoped.
struct InventoryItemLite: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let unit: String?
    let unitCost: Double?
    let quantity: Double
    let category: String?

    enum CodingKeys: String, CodingKey {
        case id, name, unit, quantity, category
        case unitCost = "unit_cost"
    }

    var priceText: String { unitCost.map { Money.grouped($0) } ?? "—" }
    var unitLabel: String { (unit?.isEmpty == false) ? unit! : "unit" }
}

private struct CategoryRow: Decodable { let category: String? }

enum Lookups {
    static func customers(siteId: String) async throws -> [CustomerLite] {
        try await supabase
            .from("customers")
            .select("id,name")
            .eq("site_id", value: siteId)
            .order("name")
            .execute()
            .value
    }

    static func phases(siteId: String) async throws -> [PhaseLite] {
        let rows: [PhaseLite] = try await supabase
            .from("production_phases")
            .select("id,name,status")
            .eq("site_id", value: siteId)
            .order("created_at", ascending: false)
            .execute()
            .value
        // Open phases first, then the rest — the default pick is the newest open one.
        return rows.sorted { ($0.isOpen ? 0 : 1) < ($1.isOpen ? 0 : 1) }
    }

    /// Cost Catalog for the site, alphabetical. Site-scoped by RLS + explicit filter.
    static func inventoryItems(siteId: String) async throws -> [InventoryItemLite] {
        try await supabase
            .from("inventory_items")
            .select("id,name,unit,unit_cost,quantity,category")
            .eq("site_id", value: siteId)
            .order("name")
            .execute()
            .value
    }

    /// Distinct non-null category strings already used at this site.
    static func categories(siteId: String) async throws -> [String] {
        let rows: [CategoryRow] = try await supabase
            .from("transactions")
            .select("category")
            .eq("site_id", value: siteId)
            .execute()
            .value
        let names = rows.compactMap { $0.category }.filter { !$0.isEmpty }
        return Array(Set(names)).sorted()
    }
}
