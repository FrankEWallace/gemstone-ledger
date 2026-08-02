import SwiftUI

/// Adaptive shell. On iPhone / compact width it's the Money-Manager bottom tab bar
/// with a raised capture FAB. On iPad / regular width it becomes a leading sidebar
/// (Apple HIG: a stretched tab bar wastes the iPad canvas), keeping the same
/// destinations. The capture pad is reachable from both.
struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.horizontalSizeClass) private var hSize
    @State private var tab: Tab = .ledger
    @State private var showEntry = false

    enum Tab: String, CaseIterable, Identifiable {
        case ledger, calendar, customers, more
        var id: String { rawValue }
        var title: String {
            switch self {
            case .ledger: "Ledger"; case .calendar: "Calendar"
            case .customers: "Customers"; case .more: "More"
            }
        }
        var icon: String {
            switch self {
            case .ledger: "list.bullet.rectangle.portrait"
            case .calendar: "calendar"
            case .customers: "person.2"
            case .more: "ellipsis"
            }
        }
    }

    var body: some View {
        Group {
            if hSize == .regular { padBody } else { phoneBody }
        }
        .fullScreenCover(isPresented: $showEntry) {
            NavigationStack { EntryPadView() }
        }
    }

    @ViewBuilder private var destination: some View {
        switch tab {
        case .ledger:    LedgerView()
        case .calendar:  CalendarView()
        case .customers: CustomersView()
        case .more:      MoreView()
        }
    }

    // MARK: - iPad: leading sidebar + detail

    private var padBody: some View {
        NavigationSplitView {
            List(selection: tabSelection) {
                ForEach(Tab.allCases) { t in
                    Label(t.title, systemImage: t.icon).tag(t)
                }
            }
            .navigationTitle("FW Mining OS")
            .safeAreaInset(edge: .bottom) { sidebarNewEntry }
        } detail: {
            destination
        }
        .navigationSplitViewStyle(.balanced)
    }

    /// List single-selection wants an optional binding; keep `tab` non-optional.
    private var tabSelection: Binding<Tab?> {
        Binding(get: { tab }, set: { if let v = $0 { tab = v } })
    }

    private var sidebarNewEntry: some View {
        Button { showEntry = true } label: {
            Label("New entry", systemImage: "plus")
                .font(.geist(16, .semibold)).foregroundStyle(.white)
                .frame(maxWidth: .infinity).frame(height: 48)
                .background(Brand.teal, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .padding(12)
    }

    // MARK: - iPhone: bottom tab bar + raised FAB (unchanged)

    private var phoneBody: some View {
        destination
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
    }

    private var tabBar: some View {
        HStack(alignment: .center, spacing: 0) {
            tabButton(.ledger)
            tabButton(.calendar)
            plusButton
            tabButton(.customers)
            tabButton(.more)
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

    private func tabButton(_ t: Tab) -> some View {
        Button { tab = t } label: {
            VStack(spacing: 3) {
                Image(systemName: t.icon).font(.system(size: 18))
                Text(t.title).font(.geist(10))
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
