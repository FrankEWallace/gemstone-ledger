import SwiftUI

// NOTE: functional stub — form layout/design gets refined next.
struct TransactionCaptureView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss

    @State private var type = "income"       // income | expense
    @State private var date = Date()
    @State private var quantity = "1"
    @State private var unitPrice = ""
    @State private var descriptionText = ""
    @State private var category = ""

    private var isValid: Bool {
        appState.activeSiteId != nil
            && quantity.optionalDouble != nil
            && unitPrice.optionalDouble != nil
    }

    var body: some View {
        Form {
            Picker("Type", selection: $type) {
                Text("Income").tag("income")
                Text("Expense").tag("expense")
            }
            .pickerStyle(.segmented)

            DatePicker("Date", selection: $date, displayedComponents: .date)

            Section {
                DecimalRow(label: "Quantity", text: $quantity)
                DecimalRow(label: "Unit price", text: $unitPrice)
            }

            Section("Details") {
                TextField("Description", text: $descriptionText)
                TextField("Category", text: $category)
            }
        }
        .navigationTitle(type == "income" ? "Record Sale" : "Record Expense")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save", action: save).disabled(!isValid)
            }
        }
    }

    private func save() {
        guard let siteId = appState.activeSiteId,
              let qty = quantity.optionalDouble,
              let price = unitPrice.optionalDouble else { return }

        let payload = TransactionPayload(
            site_id: siteId,
            type: type,
            // DB check constraint allows: success | pending | refunded | cancelled.
            // "completed" was invalid and Postgres rejected every insert.
            status: "pending",
            quantity: qty,
            unit_price: price,
            transaction_date: DateFmt.day(date),
            description: descriptionText.isEmpty ? nil : descriptionText,
            category: category.isEmpty ? nil : category,
            currency: nil
        )
        outbox.enqueue(entity: "transactions", operation: .create, payload: payload, siteId: siteId)
        dismiss()
    }
}
