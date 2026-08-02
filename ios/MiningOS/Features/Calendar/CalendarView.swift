import SwiftUI

/// Money-Manager-style month calendar over the same transactions the Ledger reads.
/// A month grid marks each day's settled income (teal) / expense (red); tapping a
/// day lists what was captured then. Money numbers are success-only, matching the
/// Ledger; days with only pending entries still get an activity dot so nothing hides.
struct CalendarView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var model = CalendarModel()
    @State private var month = MonthGrid.startOfMonth(Date())
    @State private var selectedKey = DateFmt.day(Date())

    private var grid: MonthGrid { MonthGrid(month: month) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                monthBar
                summary
                weekdayRow
                gridView
                Divider()
                dayList
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .task { await reload() }
        }
    }

    // MARK: - Month navigation + summary

    private var monthBar: some View {
        HStack {
            navButton("chevron.left") { shift(-1) }
            Spacer()
            Text(MonthGrid.title(month)).font(.geist(17, .semibold))
            Spacer()
            navButton("chevron.right") { shift(1) }
        }
        .padding(.horizontal).padding(.vertical, 10)
    }

    private func navButton(_ icon: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.body.weight(.semibold)).foregroundStyle(Brand.teal)
                .frame(width: 44, height: 36)
        }
    }

    private var summary: some View {
        let totals = model.totals(forMonthKeys: grid.monthKeys)
        return HStack(spacing: 0) {
            metric("Income", totals.income, Brand.teal)
            metric("Expense", totals.expense, Brand.expenseRed)
            metric("Net", totals.income - totals.expense, totals.income - totals.expense >= 0 ? Brand.teal : Brand.expenseRed)
        }
        .padding(.horizontal).padding(.bottom, 8)
    }

    private func metric(_ label: String, _ value: Double, _ tint: Color) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.geist(11)).foregroundStyle(.secondary)
            Text(Money.grouped(value)).font(.geist(14, .semibold)).monospacedDigit()
                .foregroundStyle(tint).minimumScaleFactor(0.6).lineLimit(1)
        }.frame(maxWidth: .infinity)
    }

    // MARK: - Grid

    private var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(MonthGrid.weekdaySymbols, id: \.self) { s in
                Text(s).font(.geist(11)).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 8).padding(.bottom, 4)
    }

    private var gridView: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
            ForEach(grid.cells) { cell in
                if let date = cell.date {
                    let key = DateFmt.day(date)
                    DayCell(
                        day: cell.dayNumber,
                        income: model.income(key), expense: model.expense(key),
                        hasActivity: model.hasActivity(key),
                        isSelected: key == selectedKey,
                        isToday: key == MonthGrid.todayKey
                    )
                    .contentShape(Rectangle())
                    .onTapGesture { selectedKey = key }
                } else {
                    Color.clear.frame(height: 56)
                }
            }
        }
        .padding(.horizontal, 6)
    }

    // MARK: - Selected day's transactions

    private var dayList: some View {
        let items = model.day(selectedKey)
        return Group {
            if items.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "tray").font(.title2).foregroundStyle(.tertiary)
                    Text("Nothing captured on \(MonthGrid.longDay(selectedKey))")
                        .font(.geist(13)).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        ForEach(items) { CalendarTxRow(tx: $0) }
                    } header: {
                        Text(MonthGrid.longDay(selectedKey)).font(.geist(12, .medium)).textCase(nil)
                    }
                }
                .listStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }

    private func shift(_ by: Int) {
        if let m = Calendar.current.date(byAdding: .month, value: by, to: month) {
            month = MonthGrid.startOfMonth(m)
        }
    }

    private func reload() async {
        guard let siteId = appState.activeSiteId else { return }
        await model.load(siteId: siteId)
    }
}

// MARK: - Day cell

private struct DayCell: View {
    let day: Int
    let income: Double
    let expense: Double
    let hasActivity: Bool
    let isSelected: Bool
    let isToday: Bool

    var body: some View {
        VStack(spacing: 2) {
            Text("\(day)")
                .font(.geist(13, isToday ? .semibold : .regular))
                .foregroundStyle(isToday ? .white : .primary)
                .frame(width: 24, height: 24)
                .background(Circle().fill(isToday ? Brand.teal : .clear))

            VStack(spacing: 0) {
                if income > 0 {
                    Text("+" + Money.compact(income)).font(.geist(9)).foregroundStyle(Brand.teal).lineLimit(1)
                }
                if expense > 0 {
                    Text("-" + Money.compact(expense)).font(.geist(9)).foregroundStyle(Brand.expenseRed).lineLimit(1)
                }
                if income == 0 && expense == 0 && hasActivity {
                    Circle().fill(Color.orange).frame(width: 5, height: 5).padding(.top, 3)
                }
            }
            .frame(height: 24)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 56)
        .background(RoundedRectangle(cornerRadius: 8).fill(isSelected ? Brand.tealTint : .clear))
    }
}

private struct CalendarTxRow: View {
    let tx: LedgerTx
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(primary).font(.geist(15)).lineLimit(1)
                if !tx.isSuccess {
                    Text(tx.status.capitalized).font(.geist(10, .medium)).foregroundStyle(.orange)
                }
            }
            Spacer(minLength: 8)
            Text((tx.isIncome ? "+" : "-") + Money.grouped(tx.amount))
                .font(.geist(15, .medium)).monospacedDigit()
                .foregroundStyle(tx.isIncome ? Brand.teal : Brand.expenseRed)
        }
    }
    private var primary: String {
        if let d = tx.description, !d.isEmpty { return d }
        if let c = tx.category, !c.isEmpty { return c }
        return tx.type.capitalized
    }
}

// MARK: - Month math

struct MonthGrid {
    struct Cell: Identifiable { let id: Int; let date: Date?; let dayNumber: Int }

    let month: Date          // start of month
    let cells: [Cell]
    let monthKeys: [String]  // yyyy-MM-dd for every real day in the month

    init(month: Date) {
        self.month = month
        let cal = Calendar.current
        let range = cal.range(of: .day, in: .month, for: month) ?? 1..<2
        let firstWeekday = cal.component(.weekday, from: month)          // 1...7
        let lead = (firstWeekday - cal.firstWeekday + 7) % 7

        var cells: [Cell] = []
        var keys: [String] = []
        for i in 0..<lead { cells.append(Cell(id: -i - 1, date: nil, dayNumber: 0)) }
        for d in range {
            let date = cal.date(byAdding: .day, value: d - 1, to: month)!
            cells.append(Cell(id: d, date: date, dayNumber: d))
            keys.append(DateFmt.day(date))
        }
        self.cells = cells
        self.monthKeys = keys
    }

    static func startOfMonth(_ date: Date) -> Date {
        let cal = Calendar.current
        return cal.date(from: cal.dateComponents([.year, .month], from: date)) ?? date
    }

    static var todayKey: String { DateFmt.day(Date()) }

    private static let titleFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "LLLL yyyy"; return f
    }()
    static func title(_ month: Date) -> String { titleFmt.string(from: month) }

    private static let longFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEEE, d MMMM"; return f
    }()
    static func longDay(_ key: String) -> String {
        guard let d = DateFmt.parseDay(key) else { return key }
        return longFmt.string(from: d)
    }

    /// Short weekday headers reordered to the calendar's first weekday.
    static var weekdaySymbols: [String] {
        let cal = Calendar.current
        let symbols = cal.veryShortStandaloneWeekdaySymbols
        let start = cal.firstWeekday - 1
        return (0..<7).map { symbols[($0 + start) % 7] }
    }
}

// MARK: - Model

@MainActor
final class CalendarModel: ObservableObject {
    @Published private(set) var loading = false
    private var byDay: [String: [LedgerTx]] = [:]

    func load(siteId: String) async {
        loading = true
        defer { loading = false }
        let txns = (try? await Ledger.transactions(siteId: siteId)) ?? []
        byDay = Dictionary(grouping: txns.filter { $0.transaction_date != nil }, by: { $0.transaction_date! })
    }

    func day(_ key: String) -> [LedgerTx] { byDay[key] ?? [] }
    func hasActivity(_ key: String) -> Bool { !(byDay[key]?.isEmpty ?? true) }

    func income(_ key: String) -> Double {
        day(key).filter { $0.isIncome && $0.isSuccess }.reduce(0) { $0 + $1.amount }
    }
    func expense(_ key: String) -> Double {
        day(key).filter { $0.isExpense && $0.isSuccess }.reduce(0) { $0 + $1.amount }
    }

    func totals(forMonthKeys keys: [String]) -> (income: Double, expense: Double) {
        keys.reduce((0, 0)) { acc, key in (acc.0 + income(key), acc.1 + expense(key)) }
    }
}
