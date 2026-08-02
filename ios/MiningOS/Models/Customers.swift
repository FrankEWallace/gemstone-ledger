import Foundation
import Supabase

/// Customer management reads for the Customers tab: the list, and the per-customer
/// P&L / contract report. Site-scoped; RLS keeps them tenant-safe.

struct CustomerFull: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let status: String
    let daily_rate: Double?
    let contract_start: String?   // "yyyy-MM-dd"
    let contract_end: String?
    let contact_phone: String?

    var isInternal: Bool { type == "internal" }
    var isActive: Bool { status == "active" }
}

/// A transaction row reduced to what the customer report needs. amount = qty × price.
struct CustomerTx: Decodable, Hashable {
    let type: String              // income | expense | refund
    let status: String            // success | pending | refunded | cancelled
    let quantity: Double
    let unit_price: Double
    let transaction_date: String?
    let description: String?
    let customer_id: String?

    var amount: Double { quantity * unit_price }
    var isSuccess: Bool { status == "success" }
    var isIncome: Bool { type == "income" }
    var isExpense: Bool { type == "expense" }
}

/// Aggregated money view for one customer, plus an optional contract projection —
/// the app's "customer × time × rate = money" idea, read-only on iOS.
struct CustomerStats {
    var income = 0.0        // income, status = success
    var expense = 0.0       // expense, status = success
    var pending = 0.0       // income, status = pending (billed, not collected)
    var count = 0
    var net: Double { income - expense }

    var contract: ContractProjection?

    init(_ txns: [CustomerTx], customer: CustomerFull) {
        for t in txns {
            count += 1
            if t.isSuccess && t.isIncome { income += t.amount }
            if t.isSuccess && t.isExpense { expense += t.amount }
            if t.isIncome && t.status == "pending" { pending += t.amount }
        }
        contract = ContractProjection(customer: customer, collected: income)
    }
}

/// Days × daily_rate = contract value; elapsed days × rate = earned to date.
struct ContractProjection {
    let dailyRate: Double
    let start: Date
    let end: Date
    let collected: Double

    var totalDays: Int { max(0, Calendar.current.dateComponents([.day], from: start, to: end).day.map { $0 + 1 } ?? 0) }
    var contractValue: Double { Double(totalDays) * dailyRate }

    var elapsedDays: Int {
        let today = min(Date(), end)
        guard today >= start else { return 0 }
        return (Calendar.current.dateComponents([.day], from: start, to: today).day ?? 0) + 1
    }
    var earnedToDate: Double { Double(elapsedDays) * dailyRate }
    var progress: Double { contractValue > 0 ? min(1, collected / contractValue) : 0 }
    var daysRemaining: Int { max(0, totalDays - elapsedDays) }

    init?(customer: CustomerFull, collected: Double) {
        guard let rate = customer.daily_rate, rate > 0,
              let s = customer.contract_start.flatMap(DateFmt.parseDay),
              let e = customer.contract_end.flatMap(DateFmt.parseDay) else { return nil }
        dailyRate = rate; start = s; end = e; self.collected = collected
    }
}

enum Customers {
    static func list(siteId: String) async throws -> [CustomerFull] {
        try await supabase
            .from("customers")
            .select("id,name,type,status,daily_rate,contract_start,contract_end,contact_phone")
            .eq("site_id", value: siteId)
            .order("name")
            .execute()
            .value
    }

    /// Every transaction that carries a customer at this site (for list totals +
    /// per-customer detail, from one snapshot).
    static func transactions(siteId: String) async throws -> [CustomerTx] {
        try await supabase
            .from("transactions")
            .select("type,status,quantity,unit_price,transaction_date,description,customer_id")
            .eq("site_id", value: siteId)
            .not("customer_id", operator: .is, value: "null")
            .order("transaction_date", ascending: false)
            .execute()
            .value
    }
}
