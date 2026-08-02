import SwiftUI

// NOTE: functional stub — the "Today" glance and grid styling get designed next.
struct HomeView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 16)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(CaptureKind.allCases) { kind in
                        NavigationLink { destination(for: kind) } label: {
                            CaptureTile(kind: kind)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle(appState.activeSite?.name ?? "Mining OS")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { SyncStatusView() }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        ForEach(appState.sites) { site in
                            Button(site.name) { appState.activeSiteId = site.id }
                        }
                        Divider()
                        Button("Sign out", role: .destructive) { Task { await appState.signOut() } }
                    } label: {
                        Image(systemName: "person.crop.circle")
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func destination(for kind: CaptureKind) -> some View {
        switch kind {
        case .production:  ProductionCaptureView()
        case .transaction: EntryPadView()
        case .inventory:   InventoryCaptureView()
        case .safety:      SafetyCaptureView()
        }
    }
}

private struct CaptureTile: View {
    let kind: CaptureKind

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: kind.systemImage)
                .font(.title)
                .foregroundStyle(kind.tint)
            Text(kind.title)
                .font(.headline)
                .multilineTextAlignment(.leading)
                .foregroundStyle(.primary)
        }
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }
}
