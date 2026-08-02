import SwiftUI

/// Top-level gate: loading -> sign in -> pick site -> home.
struct RootView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if appState.isLoading {
                ProgressView()
            } else if !appState.isAuthenticated {
                SignInView()
            } else if appState.activeSite == nil {
                SitePickerView()
            } else {
                MainTabView()
            }
        }
        .environment(\.font, .geist(17))   // app-wide default typeface
        .tint(Brand.teal)                  // teal replaces the default iOS blue
    }
}
