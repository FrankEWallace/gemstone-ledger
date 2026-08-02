import SwiftUI

// NOTE: functional stub — form layout/design gets refined next.
struct SafetyCaptureView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var severity = "low"      // low | medium | high | critical
    @State private var type = ""
    @State private var descriptionText = ""
    @State private var actionsTaken = ""

    private var isValid: Bool { appState.activeSiteId != nil && !title.isEmpty }

    var body: some View {
        Form {
            Section {
                TextField("What happened?", text: $title)
                Picker("Severity", selection: $severity) {
                    Text("Low").tag("low")
                    Text("Medium").tag("medium")
                    Text("High").tag("high")
                    Text("Critical").tag("critical")
                }
            }
            Section("Details") {
                TextField("Type (e.g. slip, equipment)", text: $type)
                TextField("Description", text: $descriptionText, axis: .vertical)
                TextField("Actions taken", text: $actionsTaken, axis: .vertical)
            }
        }
        .navigationTitle("Report Incident")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save", action: save).disabled(!isValid)
            }
        }
    }

    private func save() {
        guard let siteId = appState.activeSiteId else { return }
        let payload = SafetyIncidentPayload(
            site_id: siteId,
            title: title,
            severity: severity,
            type: type.isEmpty ? nil : type,
            description: descriptionText.isEmpty ? nil : descriptionText,
            actions_taken: actionsTaken.isEmpty ? nil : actionsTaken,
            resolution_status: "open"
        )
        outbox.enqueue(entity: "safety_incidents", operation: .create, payload: payload, siteId: siteId)
        dismiss()
    }
}
