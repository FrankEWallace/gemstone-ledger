import SwiftUI

// NOTE: functional stub — form layout/design gets refined next.
struct ProductionCaptureView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss

    @State private var logDate = Date()
    @State private var oreTonnes = ""
    @State private var wasteTonnes = ""
    @State private var gradeGT = ""
    @State private var waterM3 = ""
    @State private var notes = ""

    var body: some View {
        Form {
            DatePicker("Date", selection: $logDate, displayedComponents: .date)
            Section("Tonnage") {
                DecimalRow(label: "Ore (t)", text: $oreTonnes)
                DecimalRow(label: "Waste (t)", text: $wasteTonnes)
                DecimalRow(label: "Grade (g/t)", text: $gradeGT)
                DecimalRow(label: "Water (m³)", text: $waterM3)
            }
            Section("Notes") {
                TextField("Optional", text: $notes, axis: .vertical)
            }
        }
        .navigationTitle("Log Production")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save", action: save).disabled(appState.activeSiteId == nil)
            }
        }
    }

    private func save() {
        guard let siteId = appState.activeSiteId else { return }
        let payload = ProductionLogPayload(
            site_id: siteId,
            log_date: DateFmt.day(logDate),
            ore_tonnes: oreTonnes.optionalDouble,
            waste_tonnes: wasteTonnes.optionalDouble,
            grade_g_t: gradeGT.optionalDouble,
            water_m3: waterM3.optionalDouble,
            notes: notes.isEmpty ? nil : notes
        )
        outbox.enqueue(entity: "production_logs", operation: .create, payload: payload, siteId: siteId)
        dismiss()
    }
}

/// Shared right-aligned decimal input row.
struct DecimalRow: View {
    let label: String
    @Binding var text: String

    var body: some View {
        HStack {
            Text(label)
            Spacer()
            TextField("0", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 120)
        }
    }
}
