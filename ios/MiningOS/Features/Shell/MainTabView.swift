import SwiftUI

/// Money-Manager-style shell: four tabs with a raised center ＋ that opens the
/// capture pad. Replaces the old 4-tile grid home.
struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @State private var tab: Tab = .ledger
    @State private var showEntry = false

    private enum Tab { case ledger, calendar, customers, more }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
            .fullScreenCover(isPresented: $showEntry) {
                NavigationStack { EntryPadView() }
            }
    }

    @ViewBuilder private var content: some View {
        switch tab {
        case .ledger:    LedgerView()
        case .calendar:  CalendarView()
        case .customers: CustomersView()
        case .more:      MoreView()
        }
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        HStack(alignment: .center, spacing: 0) {
            tabButton(.ledger, "list.bullet.rectangle.portrait", "Ledger")
            tabButton(.calendar, "calendar", "Calendar")
            plusButton
            tabButton(.customers, "person.2", "Customers")
            tabButton(.more, "ellipsis", "More")
        }
        .frame(height: 54)
        .padding(.top, 8)
        .background(.bar)
        .overlay(alignment: .top) { Divider() }
    }

    private var plusButton: some View {
        Button { showEntry = true } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.bold)).foregroundStyle(.white)
                .frame(width: 52, height: 52)
                .background(Circle().fill(Brand.teal))
                .shadow(color: Brand.teal.opacity(0.35), radius: 6, y: 3)
        }
        .frame(maxWidth: .infinity)
        .offset(y: -10)
    }

    private func tabButton(_ t: Tab, _ icon: String, _ label: String) -> some View {
        Button { tab = t } label: {
            VStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: 18))
                Text(label).font(.geist(10))
            }
            .foregroundStyle(tab == t ? Brand.teal : Color.secondary)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - More (secondary captures + site + account)

struct MoreView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            List {
                Section("Capture") {
                    NavigationLink { ProductionCaptureView() } label: {
                        Label("Log production", systemImage: "hammer")
                    }
                    NavigationLink { SafetyCaptureView() } label: {
                        Label("Report incident", systemImage: "exclamationmark.shield")
                    }
                }
                Section("Site") {
                    ForEach(appState.sites, id: \.id) { site in
                        Button { appState.activeSiteId = site.id } label: {
                            HStack {
                                Text(site.name).foregroundStyle(.primary)
                                Spacer()
                                if site.id == appState.activeSiteId {
                                    Image(systemName: "checkmark").foregroundStyle(Brand.teal)
                                }
                            }
                        }
                    }
                }
                Section {
                    Button(role: .destructive) {
                        Task { await appState.signOut() }
                    } label: {
                        Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("More")
        }
    }
}
