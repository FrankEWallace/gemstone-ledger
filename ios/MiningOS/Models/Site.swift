import Foundation

/// A mining site the signed-in user can access (rows are scoped by Supabase RLS).
/// `orgId` is needed when creating org-scoped rows (customers, phases) that carry
/// a NOT NULL org_id with no DB default.
struct Site: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let orgId: String

    enum CodingKeys: String, CodingKey {
        case id, name
        case orgId = "org_id"
    }
}
