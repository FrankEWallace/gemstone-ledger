import Foundation
import Supabase

/// The ledger read: transactions for a site, plus the id→name maps needed to group
/// them by phase or customer. amount = quantity × unit_price (no stored total).
struct LedgerTx: Decodable, Identifiable, Hashable {
    let id: String
    let type: String              // income | expense | refund
    let status: String            // success | pending | refunded | cancelled
    let quantity: Double
    let unit_price: Double
    let transaction_date: String?
    let description: String?
    let category: String?
    let customer_id: String?
    let phase_id: String?

    var amount: Double { quantity * unit_price }
    var isIncome: Bool { type == "income" }
    var isExpense: Bool { type == "expense" }
    var isSuccess: Bool { status == "success" }
    /// Money in (+) vs out (−). Income adds; expense/refund subtract.
    var signed: Double { isIncome ? amount : -amount }
}

/// The three axes the ledger can group by. Phase is the default (the data is
/// phase-centric); Customer and Category are the money-management views.
enum LedgerSegment: String, CaseIterable, Identifiable {
    case phase = "Phase"
    case customer = "Customer"
    case category = "Category"
    var id: String { rawValue }
}

/// One collapsed group in the list (a phase, a customer, or a category), with its
/// own money rollup (success-only) and member transactions.
struct LedgerGroup: Identifiable {
    let id: String
    let title: String
    let income: Double
    let expense: Double
    let txns: [LedgerTx]
    var net: Double { income - expense }
}

enum Ledger {
    static func transactions(siteId: String) async throws -> [LedgerTx] {
        try await supabase
            .from("transactions")
            .select("id,type,status,quantity,unit_price,transaction_date,description,category,customer_id,phase_id")
            .eq("site_id", value: siteId)
            .order("transaction_date", ascending: false)
            .execute()
            .value
    }
}
