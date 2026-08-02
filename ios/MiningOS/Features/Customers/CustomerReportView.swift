import SwiftUI

/// Read-only customer report: money P&L (income / expense / net), an optional
/// contract projection (days × daily_rate = value, with collected progress), and
/// recent transactions. Invoice generation stays on the web app by design.
struct CustomerReportView: View {
    let customer: CustomerFull
    let txns: [CustomerTx]

    private var stats: CustomerStats { CustomerStats(txns, customer: customer) }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header
                moneyCards
                if let c = stats.contract { contractCard(c) }
                recent
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(customer.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(spacing: 6) {
            Text("Net position").font(.geist(12)).foregroundStyle(.secondary)
            Text(Money.grouped(stats.net)).font(.geist(34, .semibold)).monospacedDigit()
                .foregroundStyle(stats.net >= 0 ? Brand.teal : Brand.expenseRed)
            Text("TZS").font(.geist(11)).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Text(customer.isInternal ? "Internal" : "External")
                if let phone = customer.contact_phone, !phone.isEmpty {
                    Text("·"); Text(phone)
                }
            }
            .font(.geist(12)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 8)
    }

    private var moneyCards: some View {
        HStack(spacing: 10) {
            statCard("Income", stats.income, Brand.teal)
            statCard("Expense", stats.expense, Brand.expenseRed)
            statCard("Pending", stats.pending, .orange)
        }
    }

    private func statCard(_ label: String, _ value: Double, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.geist(12)).foregroundStyle(.secondary)
            Text(Money.grouped(value)).font(.geist(17, .semibold)).monospacedDigit()
                .foregroundStyle(tint).minimumScaleFactor(0.7).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.systemBackground)))
    }

    private func contractCard(_ c: ContractProjection) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Contract", systemImage: "calendar").font(.geist(14, .medium))
                Spacer()
                Text("\(c.daysRemaining) days left").font(.geist(12)).foregroundStyle(.secondary)
            }
            contractRow("Daily rate", Money.grouped(c.dailyRate))
            contractRow("Contract value", Money.grouped(c.contractValue))
            contractRow("Earned to date", "\(Money.grouped(c.earnedToDate))  ·  \(c.elapsedDays)/\(c.totalDays) days")
            contractRow("Collected", Money.grouped(c.collected))

            VStack(alignment: .leading, spacing: 4) {
                ProgressBar(fraction: c.progress)
                Text("\(Int(c.progress * 100))% collected").font(.geist(11)).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.systemBackground)))
    }

    private func contractRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.geist(13)).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.geist(13, .medium)).monospacedDigit()
        }
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Recent").font(.geist(14, .medium)).padding(.bottom, 8)
            if txns.isEmpty {
                Text("No transactions yet").font(.geist(13)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
            } else {
                ForEach(Array(txns.prefix(20).enumerated()), id: \.offset) { i, t in
                    if i > 0 { Divider() }
                    txnRow(t)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(.systemBackground)))
    }

    private func txnRow(_ t: CustomerTx) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(t.description ?? t.type.capitalized).font(.geist(14)).lineLimit(1)
                Text(t.transaction_date ?? "").font(.geist(11)).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Text((t.isExpense ? "-" : "+") + Money.grouped(t.amount))
                .font(.geist(14, .medium)).monospacedDigit()
                .foregroundStyle(t.isExpense ? Brand.expenseRed : Brand.teal)
        }
        .padding(.vertical, 8)
    }
}

private struct ProgressBar: View {
    let fraction: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color(.systemGray5))
                Capsule().fill(Brand.teal).frame(width: geo.size.width * max(0, min(1, fraction)))
            }
        }
        .frame(height: 8)
    }
}
