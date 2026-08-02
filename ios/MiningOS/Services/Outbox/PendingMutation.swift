import Foundation
import SwiftData

enum MutationOperation: String, Codable {
    case create
    case update
    case delete
}

/// One queued write, persisted locally until it reaches Supabase.
/// Mirrors the web app's Dexie `enqueue({ entity, operation, payload, siteId, timestamp })`.
@Model
final class PendingMutation {
    @Attribute(.unique) var id: UUID
    var entity: String          // e.g. "production_logs"
    var operationRaw: String    // create | update | delete
    var payloadJSON: Data       // encoded row payload
    var siteId: String
    var createdAt: Date
    var attempts: Int
    var lastError: String?

    var operation: MutationOperation {
        MutationOperation(rawValue: operationRaw) ?? .create
    }

    init(entity: String, operation: MutationOperation, payloadJSON: Data, siteId: String, createdAt: Date) {
        self.id = UUID()
        self.entity = entity
        self.operationRaw = operation.rawValue
        self.payloadJSON = payloadJSON
        self.siteId = siteId
        self.createdAt = createdAt
        self.attempts = 0
        self.lastError = nil
    }
}
