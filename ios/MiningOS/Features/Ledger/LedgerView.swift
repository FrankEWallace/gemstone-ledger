import SwiftUI

/// The tappable summary metrics that drill into a breakdown. (Net is a plain figure.)
private enum LedgerMetric: Hashable { case income, expense }

/// Home tab. Money-Manager "Trans." screen: a compact Income / Expense / Net header
/// (success-only) over a transaction list grouped by the chosen segment
/// (Phase · Customer · Category), defaulting to Phase.
struct LedgerView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var model = LedgerModel()
    @State private var segment: LedgerSegment = .phase
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if model.loading && model.txns.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .navigationTitle("Ledger")
            .navigationDestination(for: LedgerMetric.self) { metric in
                switch metric {
                case .income:  LedgerBreakdownView(kind: .income, txns: model.txns)
                case .expense: LedgerBreakdownView(kind: .expense, txns: model.txns)
                }
            }
            .task { await reload() }
            .refreshable { await reload() }
        }
    }

    private var content: some View {
        List {
            Section {
                summaryHeader
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 4, trailing: 16))
                    .listRowSeparator(.hidden)
                Picker("Group by", selection: $segment) {
                    ForEach(LedgerSegment.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                .listRowSeparator(.hidden)
            }

            if model.txns.isEmpty {
                Section {
                    ContentUnavailableView("No transactions", systemImage: "list.bullet.rectangle.portrait",
                                           description: Text("Tap ＋ to record income or an expense."))
                        .listRowSeparator(.hidden)
                }
            } else {
                ForEach(model.groups(for: segment)) { group in
                    Section {
                        ForEach(group.txns) { tx in LedgerRow(tx: tx) }
                    } header: {
                        GroupHeader(title: group.title, net: group.net)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Summary header (success-only in / out / net)

    private var summaryHeader: some View {
        HStack(spacing: 0) {
            Button { path.append(LedgerMetric.income) } label: {
                metric("Income", model.totalIncome, Brand.teal)
            }
            .buttonStyle(.plain)
            divider
            Button { path.append(LedgerMetric.expense) } label: {
                metric("Expense", model.totalExpense, Brand.expenseRed)
            }
            .buttonStyle(.plain)
            divider
            metric("Net", model.totalNet, model.totalNet >= 0 ? Brand.teal : Brand.expenseRed)
        }
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color(.secondarySystemGroupedBackground)))
    }

    private func metric(_ label: String, _ value: Double, _ tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(label).font(.geist(12)).foregroundStyle(.secondary)
            Text(Money.grouped(abs(value))).font(.geist(17, .semibold)).monospacedDigit()
                .foregroundStyle(tint).minimumScaleFactor(0.6).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 4)
        .contentShape(Rectangle())
    }

    private var divider: some View {
        Rectangle().fill(Color(.separator)).frame(width: 1, height: 30)
    }

    private func reload() async {
        guard let siteId = appState.activeSiteId else { return }
        await model.load(siteId: siteId)
    }
}

// MARK: - Rows

private struct GroupHeader: View {
    let title: String
    let net: Double
    var body: some View {
        HStack {
            Text(title).font(.geist(13, .medium)).foregroundStyle(.primary)
            Spacer()
            Text(Money.grouped(abs(net)))
                .font(.geist(13, .medium)).monospacedDigit()
                .foregroundStyle(net >= 0 ? Brand.teal : Brand.expenseRed)
        }
        .textCase(nil)
    }
}

private struct LedgerRow: View {
    let tx: LedgerTx
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(primary).font(.geist(15)).foregroundStyle(.primary).lineLimit(1)
                HStack(spacing: 6) {
                    Text(tx.transaction_date ?? "").font(.geist(11)).foregroundStyle(.secondary)
                    if !tx.isSuccess {
                        Text(tx.status.capitalized).font(.geist(10, .medium))
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(Capsule().fill(Color.orange.opacity(0.14)))
                    }
                }
            }
            Spacer(minLength: 8)
            Text(Money.grouped(tx.amount))
                .font(.geist(15, .medium)).monospacedDigit()
                .foregroundStyle(tx.isIncome ? Brand.teal : Brand.expenseRed)
        }
        .padding(.vertical, 2)
    }

    private var primary: String {
        if let d = tx.description, !d.isEmpty { return d }
        if let c = tx.category, !c.isEmpty { return c }
        return tx.type.capitalized
    }
}

// MARK: - Model

@MainActor
final class LedgerModel: ObservableObject {
    @Published private(set) var txns: [LedgerTx] = []
    @Published private(set) var loading = false
    private var customerNames: [String: String] = [:]
    private var phaseNames: [String: String] = [:]

    // Header totals count only settled (success) money.
    var totalIncome: Double { txns.filter { $0.isIncome && $0.isSuccess }.reduce(0) { $0 + $1.amount } }
    var totalExpense: Double { txns.filter { $0.isExpense && $0.isSuccess }.reduce(0) { $0 + $1.amount } }
    var totalNet: Double { totalIncome - totalExpense }

    func load(siteId: String) async {
        loading = true
        defer { loading = false }
        async let tx = Ledger.transactions(siteId: siteId)
        async let cs = Lookups.customers(siteId: siteId)
        async let ps = Lookups.phases(siteId: siteId)
        txns = (try? await tx) ?? []
        customerNames = Dictionary(uniqueKeysWithValues: ((try? await cs) ?? []).map { ($0.id, $0.name) })
        phaseNames = Dictionary(uniqueKeysWithValues: ((try? await ps) ?? []).map { ($0.id, $0.name) })
    }

    /// Group the transactions by the chosen axis, each group carrying a success-only
    /// income/expense rollup. Groups are ordered by activity (gross money) desc.
    func groups(for segment: LedgerSegment) -> [LedgerGroup] {
        let keyed = Dictionary(grouping: txns) { tx -> String in
            switch segment {
            case .phase:    return tx.phase_id ?? "∅"
            case .customer: return tx.customer_id ?? "∅"
            case .category: return tx.category ?? "∅"
            }
        }

        return keyed.map { key, group in
            let income = group.filter { $0.isIncome && $0.isSuccess }.reduce(0) { $0 + $1.amount }
            let expense = group.filter { $0.isExpense && $0.isSuccess }.reduce(0) { $0 + $1.amount }
            return LedgerGroup(
                id: "\(segment.rawValue):\(key)",
                title: title(for: segment, key: key),
                income: income, expense: expense,
                txns: group.sorted { ($0.transaction_date ?? "") > ($1.transaction_date ?? "") }
            )
        }
        .sorted { ($0.income + $0.expense) > ($1.income + $1.expense) }
    }

    private func title(for segment: LedgerSegment, key: String) -> String {
        if key == "∅" {
            switch segment {
            case .phase:    return "No phase"
            case .customer: return "No customer"
            case .category: return "Uncategorised"
            }
        }
        switch segment {
        case .phase:    return phaseNames[key] ?? "Phase"
        case .customer: return customerNames[key] ?? "Customer"
        case .category: return key
        }
    }
}
