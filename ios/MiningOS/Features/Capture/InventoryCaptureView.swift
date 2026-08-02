import SwiftUI

// NOTE: functional stub — form layout/design gets refined next.
struct InventoryCaptureView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var quantity = ""
    @State private var category = ""
    @State private var sku = ""
    @State private var unit = ""
    @State private var unitCost = ""
    @State private var reorderLevel = ""

    private var isValid: Bool {
        appState.activeSiteId != nil && !name.isEmpty && quantity.optionalDouble != nil
    }

    var body: some View {
        Form {
            Section {
                TextField("Name", text: $name)
                DecimalRow(label: "Quantity", text: $quantity)
                TextField("Unit (kg, ea…)", text: $unit)
            }
            Section("Optional") {
                TextField("Category", text: $category)
                TextField("SKU", text: $sku)
                DecimalRow(label: "Unit cost", text: $unitCost)
                DecimalRow(label: "Reorder level", text: $reorderLevel)
            }
        }
        .navigationTitle("Add Inventory")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save", action: save).disabled(!isValid)
            }
        }
    }

    private func save() {
        guard let siteId = appState.activeSiteId,
              let qty = quantity.optionalDouble else { return }

        let payload = InventoryItemPayload(
            site_id: siteId,
            name: name,
            quantity: qty,
            category: category.isEmpty ? nil : category,
            sku: sku.isEmpty ? nil : sku,
            unit: unit.isEmpty ? nil : unit,
            unit_cost: unitCost.optionalDouble,
            reorder_level: reorderLevel.optionalDouble
        )
        outbox.enqueue(entity: "inventory_items", operation: .create, payload: payload, siteId: siteId)
        dismiss()
    }
}
