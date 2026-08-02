import SwiftUI

/// Branded site chooser shown after sign-in when a site isn't yet active.
/// Selecting a site sets `activeSiteId`, which flips RootView to the main app.
struct SitePickerView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 14) {
                        BrandMark(size: 60)
                        VStack(spacing: 3) {
                            Text("Choose a site").font(.geist(22, .semibold))
                            Text("Pick the site you're capturing for")
                                .font(.geist(14)).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 40)

                    if appState.sites.isEmpty {
                        ContentUnavailableView {
                            Label("No sites yet", systemImage: "mountain.2")
                        } description: {
                            Text("This account has no sites. Create one in the web app first.")
                        }
                        .padding(.top, 40)
                    } else {
                        VStack(spacing: 12) {
                            ForEach(appState.sites) { site in
                                SiteCard(site: site, isActive: site.id == appState.activeSiteId) {
                                    appState.activeSiteId = site.id
                                }
                            }
                        }
                    }
                }
                .padding(24)
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
            }
            .background(BrandBackground())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Sign out") { Task { await appState.signOut() } }
                        .font(.geist(15)).foregroundStyle(Brand.teal)
                }
            }
        }
    }
}

private struct SiteCard: View {
    let site: Site
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12).fill(Brand.tealTint).frame(width: 44, height: 44)
                    Image(systemName: "mountain.2.fill").foregroundStyle(Brand.teal)
                }
                Text(site.name).font(.geist(16, .medium)).foregroundStyle(.primary).lineLimit(1)
                Spacer(minLength: 8)
                Image(systemName: isActive ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundStyle(isActive ? Brand.teal : Color(.tertiaryLabel))
            }
            .padding(14)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isActive ? Brand.teal : Color.clear, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
