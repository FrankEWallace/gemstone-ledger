import SwiftUI

@main
struct MiningOSApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var outbox = Outbox()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(outbox)
                .task { await appState.bootstrap() }
        }
    }
}
