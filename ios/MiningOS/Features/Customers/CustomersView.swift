import SwiftUI

/// Customers tab. Compact (iPhone): a directory that pushes to a per-customer
/// report. Regular (iPad): a list-detail split — pick a customer on the left,
/// read their report on the right (the layout finance apps use on iPad).
struct CustomersView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.horizontalSizeClass) private var hSize
    @StateObject private var model = CustomersModel()
    @State private var showAdd = false
    @State private var selectedId: String?

    var body: some View {
        Group {
            if hSize == .regular { padBody } else { phoneBody }
        }
        .task { await reload() }
        .sheet(isPresented: $showAdd) {
            AddCustomerSheet { created in
                model.insertOptimistic(created)
                selectedId = created.id
                Task { await reload() }
            }
        }
    }

    // MARK: - iPhone: list that pushes to the report

    private var phoneBody: some View {
        NavigationStack {
            Group {
                if model.loading && model.customers.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.customers.isEmpty {
                    emptyState
                } else {
                    List {
                        Section {
                            ForEach(model.customers) { c in
                                NavigationLink {
                                    CustomerReportView(customer: c, txns: model.txns(for: c.id))
                                } label: {
                                    CustomerRow(customer: c, income: model.income(for: c.id))
                                }
                            }
                        } header: {
                            Text("^[\(model.customers.count) customer](inflect: true)")
                        }
                    }
                }
            }
            .navigationTitle("Customers")
            .toolbar { addButton }
            .refreshable { await reload() }
        }
    }

    // MARK: - iPad: list-detail split

    private var padBody: some View {
        NavigationStack {
            HStack(spacing: 0) {
                Group {
                    if model.customers.isEmpty {
                        emptyState
                    } else {
                        List(selection: $selectedId) {
                            ForEach(model.customers) { c in
                                CustomerRow(customer: c, income: model.income(for: c.id)).tag(c.id)
                            }
                        }
                    }
                }
                .frame(width: 340)
                .refreshable { await reload() }

                Divider()

                detailPane
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Customers")
            .toolbar { addButton }
        }
    }

    @ViewBuilder private var detailPane: some View {
        if let id = selectedId, let c = model.customers.first(where: { $0.id == id }) {
            CustomerReportView(customer: c, txns: model.txns(for: c.id))
        } else {
            ContentUnavailableView("Select a customer", systemImage: "person.text.rectangle",
                                   description: Text("Pick someone on the left to see their report."))
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No customers", systemImage: "person.2")
        } description: {
            Text("Add your first customer to start tracking their income and contract.")
        } actions: {
            Button("Add customer") { showAdd = true }.buttonStyle(.borderedProminent).tint(Brand.teal)
        }
    }

    private var addButton: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button { showAdd = true } label: { Image(systemName: "plus") }
        }
    }

    private func reload() async {
        guard let siteId = appState.activeSiteId else { return }
        await model.load(siteId: siteId)
        if selectedId == nil { selectedId = model.customers.first?.id }   // iPad: fill the detail pane
    }
}

private struct CustomerRow: View {
    let customer: CustomerFull
    let income: Double

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Brand.tealTint).frame(width: 38, height: 38)
                Text(initials).font(.geist(14, .semibold)).foregroundStyle(Brand.teal)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(customer.name).font(.geist(16, .medium)).foregroundStyle(.primary).lineLimit(1)
                HStack(spacing: 6) {
                    TypeBadge(isInternal: customer.isInternal)
                    if !customer.isActive {
                        Text(customer.status.capitalized).font(.geist(11)).foregroundStyle(.secondary)
                    }
                }
            }
            Spacer(minLength: 8)
            if income > 0 {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(Money.grouped(income)).font(.geist(15, .semibold)).monospacedDigit().foregroundStyle(Brand.teal)
                    Text("income").font(.geist(10)).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var initials: String {
        let parts = customer.name.split(separator: " ").prefix(2)
        return parts.map { String($0.first ?? " ") }.joined().uppercased()
    }
}

private struct TypeBadge: View {
    let isInternal: Bool
    var body: some View {
        Text(isInternal ? "Internal" : "External")
            .font(.geist(11, .medium))
            .padding(.horizontal, 7).padding(.vertical, 2)
            .foregroundStyle(isInternal ? Color.orange : Brand.teal)
            .background(Capsule().fill((isInternal ? Color.orange : Brand.teal).opacity(0.12)))
    }
}

// MARK: - Model

@MainActor
final class CustomersModel: ObservableObject {
    @Published var customers: [CustomerFull] = []
    @Published private(set) var loading = false
    private var byCustomer: [String: [CustomerTx]] = [:]

    func load(siteId: String) async {
        loading = true
        defer { loading = false }
        async let list = Customers.list(siteId: siteId)
        async let txns = Customers.transactions(siteId: siteId)
        let (customers, txns2) = ((try? await list) ?? [], (try? await txns) ?? [])
        self.customers = customers
        byCustomer = Dictionary(grouping: txns2.filter { $0.customer_id != nil }, by: { $0.customer_id! })
    }

    func txns(for id: String) -> [CustomerTx] { byCustomer[id] ?? [] }

    func income(for id: String) -> Double {
        txns(for: id).filter { $0.isIncome && $0.isSuccess }.reduce(0) { $0 + $1.amount }
    }

    /// Show a just-added customer immediately, before the outbox sync + reload lands.
    func insertOptimistic(_ c: CustomerFull) {
        guard !customers.contains(where: { $0.id == c.id }) else { return }
        customers.append(c)
        customers.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
}
