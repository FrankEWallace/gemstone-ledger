import SwiftUI

/// Tiny badge showing offline / pending / synced state.
struct SyncStatusView: View {
    @EnvironmentObject var outbox: Outbox

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }

    private var color: Color {
        if !outbox.isOnline { return .gray }
        return outbox.pendingCount > 0 ? .orange : .green
    }

    private var label: String {
        if !outbox.isOnline {
            return outbox.pendingCount > 0 ? "Offline · \(outbox.pendingCount)" : "Offline"
        }
        if outbox.isFlushing { return "Syncing…" }
        return outbox.pendingCount > 0 ? "\(outbox.pendingCount) pending" : "Synced"
    }
}
