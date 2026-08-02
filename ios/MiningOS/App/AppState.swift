import Foundation
import Supabase

/// Session + tenant (org -> site) scoping. The web app had a bug where a null
/// active site caused silent write failures; here `activeSiteId` is persisted
/// and the UI blocks captures until a site is selected.
@MainActor
final class AppState: ObservableObject {
    @Published var session: Session?
    @Published var sites: [Site] = []
    @Published var isLoading = true

    @Published var activeSiteId: String? {
        didSet { UserDefaults.standard.set(activeSiteId, forKey: Self.activeSiteKey) }
    }

    private static let activeSiteKey = "activeSiteId"

    var isAuthenticated: Bool { session != nil }
    var activeSite: Site? { sites.first { $0.id == activeSiteId } }
    /// Org of the active site — required when inserting org-scoped rows.
    var activeOrgId: String? { activeSite?.orgId }

    init() {
        activeSiteId = UserDefaults.standard.string(forKey: Self.activeSiteKey)
    }

    func bootstrap() async {
        session = try? await supabase.auth.session
        if session != nil { await loadSites() }
        isLoading = false

        // Keep session in sync with auth events (refresh, sign-out from elsewhere).
        Task {
            for await change in supabase.auth.authStateChanges {
                self.session = change.session
                if change.session != nil {
                    await self.loadSites()
                } else {
                    self.sites = []
                    self.activeSiteId = nil
                }
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        session = try await supabase.auth.signIn(email: email, password: password)
        await loadSites()
    }

    func signOut() async {
        try? await supabase.auth.signOut()
        session = nil
        sites = []
        activeSiteId = nil
    }

    func loadSites() async {
        do {
            let rows: [Site] = try await supabase
                .from("sites")
                .select("id,name,org_id")
                .order("name")
                .execute()
                .value
            sites = rows
            if activeSiteId == nil || !rows.contains(where: { $0.id == activeSiteId }) {
                activeSiteId = rows.first?.id
            }
        } catch {
            print("loadSites failed: \(error)")
        }
    }
}
