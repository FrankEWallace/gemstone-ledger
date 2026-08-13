import SwiftUI

/// Create a customer. Writes go through the offline outbox with a client-generated
/// id, so the new customer is usable immediately (optimistic) and syncs later.
struct AddCustomerSheet: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss

    /// Called with the optimistic customer once enqueued.
    let onCreate: (CustomerFull) -> Void

    @State private var name = ""
    @State private var isInternal = false
    @State private var phone = ""
    @State private var dailyRate = ""
    @State private var hasContract = false
    @State private var start = Date()
    @State private var end = Calendar.current.date(byAdding: .month, value: 1, to: Date()) ?? Date()
    @State private var notes = ""

    private var trimmedName: String { name.trimmingCharacters(in: .whitespaces) }
    private var isValid: Bool { !trimmedName.isEmpty && appState.activeSiteId != nil && appState.activeOrgId != nil }

    var body: some View {
        NavigationStack {
            Form {
                Section("Customer") {
                    TextField("Name", text: $name)
                        .font(.geist(16)).textInputAutocapitalization(.words)
                    Picker("Type", selection: $isInternal) {
                        Text("External").tag(false)
                        Text("Internal").tag(true)
                    }.pickerStyle(.segmented)
                    TextField("Phone (optional)", text: $phone)
                        .keyboardType(.phonePad)
                }

                Section {
                    HStack {
                        Text("Daily rate")
                        Spacer()
                        TextField("0", text: $dailyRate.moneyGrouped())
                            .keyboardType(.numberPad).multilineTextAlignment(.trailing).monospacedDigit()
                        Text("TZS").foregroundStyle(.secondary)
                    }
                    Toggle("Fixed contract dates", isOn: $hasContract.animation())
                    if hasContract {
                        DatePicker("Start", selection: $start, displayedComponents: .date)
                        DatePicker("End", selection: $end, in: start..., displayedComponents: .date)
                    }
                } header: {
                    Text("Contract")
                } footer: {
                    Text("Daily rate × contract days projects the customer's contract value in their report.")
                }

                Section("Notes") {
                    TextField("Optional", text: $notes, axis: .vertical).lineLimit(1...4)
                }
            }
            .navigationTitle("New customer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).fontWeight(.semibold).disabled(!isValid)
                }
            }
        }
    }

    private func save() {
        guard let siteId = appState.activeSiteId, let orgId = appState.activeOrgId else { return }
        let id = UUID().uuidString.lowercased()
        let rate = dailyRate.optionalDouble
        let startStr = hasContract ? DateFmt.day(start) : nil
        let endStr = hasContract ? DateFmt.day(end) : nil
        let phoneTrim = phone.trimmingCharacters(in: .whitespaces)
        let notesTrim = notes.trimmingCharacters(in: .whitespaces)

        let payload = CustomerCreatePayload(
            id: id, site_id: siteId, org_id: orgId,
            name: trimmedName,
            type: isInternal ? "internal" : "external",
            status: "active",
            contact_phone: phoneTrim.isEmpty ? nil : phoneTrim,
            daily_rate: rate,
            contract_start: startStr,
            contract_end: endStr,
            notes: notesTrim.isEmpty ? nil : notesTrim
        )
        outbox.enqueue(entity: "customers", operation: .create, payload: payload, siteId: siteId)

        onCreate(CustomerFull(
            id: id, name: trimmedName,
            type: isInternal ? "internal" : "external", status: "active",
            daily_rate: rate, contract_start: startStr, contract_end: endStr,
            contact_phone: phoneTrim.isEmpty ? nil : phoneTrim
        ))
        dismiss()
    }
}
