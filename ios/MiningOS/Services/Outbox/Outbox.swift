import Foundation
import SwiftData
import Network
import Supabase

/// Offline-first write queue. Every capture is appended locally and returns
/// instantly; a background flusher drains the queue to Supabase whenever the
/// network is available, oldest-first, preserving order.
@MainActor
final class Outbox: ObservableObject {
    @Published private(set) var pendingCount: Int = 0
    @Published private(set) var isOnline: Bool = true
    @Published private(set) var isFlushing: Bool = false

    private let container: ModelContainer
    private var context: ModelContext { container.mainContext }
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "com.miningos.outbox.monitor")

    /// Payloads are encoded with exact snake_case keys, so no key strategy here.
    private let encoder = JSONEncoder()

    init() {
        do {
            container = try ModelContainer(for: PendingMutation.self)
        } catch {
            fatalError("Failed to create SwiftData container: \(error)")
        }
        refreshCount()
        startMonitoring()
    }

    // MARK: - Public API

    /// Append a write to the queue. Returns immediately; sync happens in the background.
    func enqueue<T: Encodable>(entity: String, operation: MutationOperation, payload: T, siteId: String) {
        do {
            let data = try encoder.encode(payload)
            let mutation = PendingMutation(
                entity: entity,
                operation: operation,
                payloadJSON: data,
                siteId: siteId,
                createdAt: Date()
            )
            context.insert(mutation)
            try context.save()
            refreshCount()
            Task { await flush() }
        } catch {
            assertionFailure("enqueue failed to encode payload: \(error)")
        }
    }

    /// Drain the queue. Safe to call repeatedly; no-ops if offline or already running.
    func flush() async {
        guard isOnline, !isFlushing else { return }
        isFlushing = true
        defer {
            isFlushing = false
            refreshCount()
        }

        let descriptor = FetchDescriptor<PendingMutation>(
            sortBy: [SortDescriptor(\.createdAt, order: .forward)]
        )
        guard let items = try? context.fetch(descriptor) else { return }

        for item in items {
            do {
                try await push(item)
                context.delete(item)
                try? context.save()
            } catch {
                // Preserve order: stop on the first failure and retry on the next tick.
                item.attempts += 1
                item.lastError = String(describing: error)
                try? context.save()
                break
            }
        }
    }

    // MARK: - Internals

    private func push(_ mutation: PendingMutation) async throws {
        let json = try JSONDecoder().decode(AnyJSON.self, from: mutation.payloadJSON)

        switch mutation.operation {
        case .create:
            try await supabase.from(mutation.entity).insert(json).execute()

        case .update:
            guard let id = idString(from: json) else { return }
            try await supabase.from(mutation.entity).update(json).eq("id", value: id).execute()

        case .delete:
            guard let id = idString(from: json) else { return }
            try await supabase.from(mutation.entity).delete().eq("id", value: id).execute()
        }
    }

    private func idString(from json: AnyJSON) -> String? {
        guard case let .object(dict) = json, let idValue = dict["id"] else { return nil }
        if case let .string(s) = idValue { return s }
        return nil
    }

    private func refreshCount() {
        pendingCount = (try? context.fetchCount(FetchDescriptor<PendingMutation>())) ?? 0
    }

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isOnline = path.status == .satisfied
                if self.isOnline { await self.flush() }
            }
        }
        monitor.start(queue: monitorQueue)
    }
}
