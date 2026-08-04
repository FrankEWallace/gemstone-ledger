import SwiftUI

/// Drill-down from the Ledger's Income / Expense metric: the paid, site-wide total
/// for one type, split by category (with share bars), then the underlying entries.
/// Reuses the transactions the Ledger already loaded, so totals reconcile exactly.
struct LedgerBreakdownView: View {
    enum Kind {
        case income, expense
        var isIncome: Bool { self == .income }
        var title: String { isIncome ? "Income" : "Expense" }
        var tint: Color { isIncome ? Brand.teal : Brand.expenseRed }
        var matches: String { isIncome ? "income" : "expense" }
    }

    let kind: Kind
    let txns: [LedgerTx]

    private var rows: [LedgerTx] { txns.filter { $0.type == kind.matches && $0.isSuccess } }
    private var total: Double { rows.reduce(0) { $0 + $1.amount } }

    private var groups: [(name: String, amount: Double, share: Double)] {
        var by: [String: Double] = [:]
        for t in rows { by[t.category ?? "Uncategorised", default: 0] += t.amount }
        return by
            .map { (name: $0.key, amount: $0.value, share: total > 0 ? $0.value / total : 0) }
            .sorted { $0.amount > $1.amount }
    }

    private var entries: [LedgerTx] {
        rows.sorted { ($0.transaction_date ?? "") > ($1.transaction_date ?? "") }
    }

    var body: some View {
        List {
            Section {
                VStack(spacing: 4) {
                    Text("Total \(kind.isIncome ? "income" : "expense")").font(.geist(12)).foregroundStyle(.secondary)
                    Text(Money.grouped(total)).font(.geist(30, .semibold)).monospacedDigit()
                        .foregroundStyle(kind.tint).minimumScaleFactor(0.6).lineLimit(1)
                    Text("paid · site-wide").font(.geist(11)).foregroundStyle(.tertiary)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 8)
                .listRowSeparator(.hidden)
            }

            if groups.isEmpty {
                Section {
                    ContentUnavailableView("No \(kind.isIncome ? "income" : "expense") yet", systemImage: "chart.pie")
                }
            } else {
                Section("By category") {
                    ForEach(groups, id: \.name) { g in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(g.name).font(.geist(15, .medium)).lineLimit(1)
                                Spacer(minLength: 8)
                                Text(Money.grouped(g.amount)).font(.geist(15, .medium)).monospacedDigit()
                            }
                            HStack(spacing: 8) {
                                ShareBar(fraction: g.share, tint: kind.tint)
                                Text("\(Int((g.share * 100).rounded()))%")
                                    .font(.geist(11)).foregroundStyle(.secondary)
                                    .frame(width: 34, alignment: .trailing).monospacedDigit()
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("Entries") {
                    ForEach(entries) { t in
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(t.description ?? t.category ?? kind.title).font(.geist(15)).lineLimit(1)
                                Text([t.transaction_date ?? "", t.category ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.geist(11)).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            Text((kind.isIncome ? "" : "-") + Money.grouped(t.amount))
                                .font(.geist(15, .medium)).monospacedDigit().foregroundStyle(kind.tint)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("\(kind.title) breakdown")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Bars

/// Left-anchored share bar (0…1 of the container width).
private struct ShareBar: View {
    let fraction: Double
    let tint: Color
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color(.systemGray5))
                Capsule().fill(tint).frame(width: max(4, geo.size.width * min(1, max(0, fraction))))
            }
        }
        .frame(height: 6)
    }
}
