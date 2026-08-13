import SwiftUI

/// Cost Catalog — the per-site price list for volatile consumables (diesel, cement…).
/// Replaces the old Calendar tab. Tap an item to adjust today's price; the expense
/// pad reads these prices so recording "4 L diesel" computes the amount automatically.
/// Prices are snapshotted onto each transaction, so editing here never rewrites history.
struct CatalogView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @StateObject private var model = CatalogModel()

    @State private var editing: InventoryItemLite?
    @State private var showAdd = false

    var body: some View {
        NavigationStack {
            Group {
                if model.isLoading && model.items.isEmpty {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if model.items.isEmpty {
                    empty
                } else {
                    list
                }
            }
            .navigationTitle("Prices")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showAdd = true } label: { Image(systemName: "plus") }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .sheet(item: $editing) { item in
                EditPriceSheet(item: item) { newPrice in
                    updatePrice(item, to: newPrice)
                }
                .presentationDetents([.height(300)])
                .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showAdd) {
                AddItemSheet { lite in
                    model.upsert(lite)
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
    }

    private func load() async {
        guard let siteId = appState.activeSiteId else { return }
        await model.load(siteId: siteId)
    }

    // MARK: - List

    private var list: some View {
        List {
            Section {
                ForEach(model.items) { item in
                    Button { editing = item } label: { row(item) }
                        .buttonStyle(.plain)
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func row(_ item: InventoryItemLite) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(item.name).font(.geist(16, .medium)).foregroundStyle(.primary).lineLimit(1)
                Text(subtitle(item)).font(.geist(12)).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 2) {
                Text(item.priceText).font(.geist(17, .semibold)).monospacedDigit()
                    .foregroundStyle(item.unitCost == nil ? Color(.tertiaryLabel) : Brand.teal)
                Text("/ \(item.unitLabel)").font(.geist(11)).foregroundStyle(.tertiary)
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    private func subtitle(_ item: InventoryItemLite) -> String {
        var parts: [String] = []
        if let c = item.category, !c.isEmpty { parts.append(c) }
        parts.append("\(Money.grouped(item.quantity)) \(item.unitLabel) on hand")
        return parts.joined(separator: " · ")
    }

    private var empty: some View {
        ContentUnavailableView {
            Label("No priced items yet", systemImage: "tag")
        } description: {
            Text("Add the things you buy by quantity — diesel, cement, gravel — with today's price. Then record expenses just by entering how much was used.")
        } actions: {
            Button { showAdd = true } label: {
                Text("Add an item").font(.geist(15, .semibold))
            }
            .buttonStyle(.borderedProminent).tint(Brand.teal)
        }
    }

    // MARK: - Writes

    private func updatePrice(_ item: InventoryItemLite, to newPrice: Double) {
        guard let siteId = appState.activeSiteId else { return }
        outbox.enqueue(entity: "inventory_items", operation: .update,
                       payload: InventoryPriceUpdate(id: item.id, unit_cost: newPrice),
                       siteId: siteId)
        model.setPrice(id: item.id, to: newPrice)   // optimistic
    }
}

// MARK: - Model

@MainActor
final class CatalogModel: ObservableObject {
    @Published var items: [InventoryItemLite] = []
    @Published var isLoading = false

    func load(siteId: String) async {
        isLoading = true
        defer { isLoading = false }
        items = (try? await Lookups.inventoryItems(siteId: siteId)) ?? items
    }

    func setPrice(id: String, to price: Double) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        let old = items[i]
        items[i] = InventoryItemLite(id: old.id, name: old.name, unit: old.unit,
                                     unitCost: price, quantity: old.quantity, category: old.category)
    }

    func upsert(_ item: InventoryItemLite) {
        if let i = items.firstIndex(where: { $0.id == item.id }) {
            items[i] = item
        } else {
            items.append(item)
            items.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
    }
}

// MARK: - Edit price sheet

private struct EditPriceSheet: View {
    let item: InventoryItemLite
    let onSave: (Double) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text: String

    init(item: InventoryItemLite, onSave: @escaping (Double) -> Void) {
        self.item = item; self.onSave = onSave
        _text = State(initialValue: item.unitCost.map { Money.plain($0) } ?? "")
    }

    private var value: Double? { text.optionalDouble }
    private var canSave: Bool { (value ?? 0) > 0 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text("Price per \(item.unitLabel)").font(.geist(15)).foregroundStyle(.secondary)
                        Spacer()
                        TextField("0", text: $text.moneyGrouped())
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .font(.geist(20, .semibold))
                    }
                } header: {
                    Text(item.name)
                }
            }
            .navigationTitle("Update price")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { if let v = value { onSave(v) }; dismiss() }
                        .fontWeight(.semibold).disabled(!canSave)
                }
            }
        }
    }
}

// MARK: - Add item sheet

private struct AddItemSheet: View {
    let onAdd: (InventoryItemLite) -> Void
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var unit = ""
    @State private var price = ""
    @State private var quantity = ""
    @State private var category = ""

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && appState.activeSiteId != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    TextField("Name (e.g. Diesel)", text: $name)
                        .textInputAutocapitalization(.words)
                    TextField("Unit (L, bag, ton…)", text: $unit)
                    HStack {
                        Text("Price per unit").foregroundStyle(.secondary)
                        Spacer()
                        TextField("0", text: $price.moneyGrouped()).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                }
                Section("Optional") {
                    HStack {
                        Text("Opening stock").foregroundStyle(.secondary)
                        Spacer()
                        TextField("0", text: $quantity).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                    TextField("Category", text: $category)
                }
            }
            .navigationTitle("New item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: save).fontWeight(.semibold).disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        guard let siteId = appState.activeSiteId else { return }
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return }
        let id = UUID().uuidString.lowercased()
        let u = unit.trimmingCharacters(in: .whitespaces)
        let c = category.trimmingCharacters(in: .whitespaces)
        let qty = quantity.optionalDouble ?? 0
        let cost = price.optionalDouble

        let payload = InventoryItemPayload(
            id: id, site_id: siteId, name: n, quantity: qty,
            category: c.isEmpty ? nil : c, sku: nil,
            unit: u.isEmpty ? nil : u, unit_cost: cost, reorder_level: nil
        )
        outbox.enqueue(entity: "inventory_items", operation: .create, payload: payload, siteId: siteId)
        onAdd(InventoryItemLite(id: id, name: n, unit: u.isEmpty ? nil : u,
                                unitCost: cost, quantity: qty, category: c.isEmpty ? nil : c))
        dismiss()
    }
}
