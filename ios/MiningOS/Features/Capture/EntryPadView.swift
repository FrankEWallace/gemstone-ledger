import SwiftUI

/// Money-Manager-style entry: a form of fields; tapping Amount slides up a
/// calculator sheet that evaluates (e.g. 1,500,000 × 6) and auto-splits the
/// result into unit_price × quantity. Save lives in the nav bar.
struct EntryPadView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var outbox: Outbox
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = EntryPadModel()

    @State private var type = "expense"          // income | expense | refund
    @State private var status = "success"        // success (Paid) | pending
    @State private var unitPrice = 0.0
    @State private var quantity = 1.0
    @State private var amountExpr = ""           // last calculator expression
    @State private var date = Date()

    @State private var category: String?
    @State private var customerId: String?
    @State private var customerName: String?
    @State private var phaseId: String?
    @State private var phaseName: String?
    @State private var note = ""
    @State private var reference = ""

    @State private var showCalc = false
    @State private var showCategory = false
    @State private var showCustomer = false
    @State private var showPhase = false

    private let types = ["income", "expense", "inventory"]

    // Inventory-mode fields
    @State private var itemName = ""
    @State private var unit = ""
    @State private var unitCost = 0.0
    @State private var calcTarget: CalcTarget = .amount
    private enum CalcTarget { case amount, quantity, unitCost }

    private var total: Double { unitPrice * quantity }
    private var isInventory: Bool { type == "inventory" }
    private var isValid: Bool {
        guard appState.activeSiteId != nil else { return false }
        if isInventory { return !itemName.trimmingCharacters(in: .whitespaces).isEmpty && quantity > 0 }
        return total > 0
    }
    private var accent: Color { Brand.typeColor(type) }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                typeSegment.padding(.horizontal).padding(.vertical, 10)
                fieldCard
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("New entry")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save", action: save).fontWeight(.semibold).disabled(!isValid)
            }
        }
        .task {
            guard let siteId = appState.activeSiteId else { return }
            await model.load(siteId: siteId)
            if phaseId == nil, let open = model.phases.first(where: { $0.isOpen }) ?? model.phases.first {
                phaseId = open.id; phaseName = open.name
            }
        }
        .sheet(isPresented: $showCalc) {
            CalculatorSheet(accent: accent, initial: calcTarget == .amount ? amountExpr : "") { r, expr in
                switch calcTarget {
                case .amount:   applyAmount(r, expr)
                case .quantity: quantity = r
                case .unitCost: unitCost = r
                }
            }
            .presentationDetents([.height(440)])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showCategory) {
            CategoryPickerSheet(categories: model.categories, selected: category) { category = $0 }
                .presentationDetents([.height(420)])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showCustomer) {
            CustomerPickerSheet(customers: model.customers, selectedId: customerId, onCreate: createCustomer) {
                customerId = $0?.id; customerName = $0?.name
            }
            .presentationDetents([.height(460)])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showPhase) {
            PhasePickerSheet(phases: model.phases, selectedId: phaseId, onCreate: createPhase) {
                phaseId = $0?.id; phaseName = $0?.name
            }
            .presentationDetents([.height(460)])
            .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Type segment (bordered, MM-style)

    private var typeSegment: some View {
        HStack(spacing: 10) {
            ForEach(types, id: \.self) { t in
                let on = type == t
                Button {
                    if (type == "inventory") != (t == "inventory") {
                        unitPrice = 0; quantity = 1; unitCost = 0; amountExpr = ""
                    }
                    type = t
                } label: {
                    Text(t.capitalized)
                        .font(.geist(15, .medium))
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .foregroundStyle(on ? Brand.typeColor(t) : Color.secondary)
                        .background(RoundedRectangle(cornerRadius: 10)
                            .stroke(on ? Brand.typeColor(t) : Color(.systemGray4), lineWidth: on ? 1.6 : 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Field card

    private var fieldCard: some View {
        VStack(spacing: 0) {
            if isInventory { inventoryRows } else { transactionRows }
        }
        .background(Color(.systemBackground))
    }

    private var transactionRows: some View {
        VStack(spacing: 0) {
            controlRow("Date") {
                DatePicker("", selection: $date, displayedComponents: .date).labelsHidden()
            }
            Divider().padding(.leading, 96)

            amountRow("Amount", value: total, expr: quantity != 1) { calcTarget = .amount; showCalc = true }
            if quantity != 1 {
                HStack {
                    Spacer()
                    Text("\(Money.grouped(unitPrice)) × \(Money.grouped(quantity))")
                        .font(.geist(12)).foregroundStyle(.secondary)
                }
                .padding(.horizontal).padding(.bottom, 6)
            }
            Divider().padding(.leading, 96)

            tapRow("Category", category ?? "None") { showCategory = true }
            Divider().padding(.leading, 96)
            tapRow("Customer", customerName ?? "None") { showCustomer = true }
            Divider().padding(.leading, 96)
            tapRow("Phase", phaseName ?? "None") { showPhase = true }
            Divider().padding(.leading, 96)

            controlRow("Status") {
                Button { status = status == "success" ? "pending" : "success" } label: {
                    Text(status == "success" ? "Paid" : "Pending")
                        .font(.geist(15, .medium))
                        .foregroundStyle(status == "success" ? Brand.teal : .orange)
                }
            }
            Divider().padding(.leading, 96)

            fieldRow("Note", "Optional", $note)
        }
    }

    private var inventoryRows: some View {
        VStack(spacing: 0) {
            fieldRow("Name", "Item name", $itemName)
            Divider().padding(.leading, 96)

            amountRow("Quantity", value: quantity, expr: false) { calcTarget = .quantity; showCalc = true }
            Divider().padding(.leading, 96)

            fieldRow("Unit", "kg, bags…", $unit)
            Divider().padding(.leading, 96)

            Button { calcTarget = .unitCost; showCalc = true } label: {
                HStack {
                    label("Unit cost")
                    Spacer()
                    Text(unitCost > 0 ? Money.grouped(unitCost) : "Optional")
                        .font(.geist(16))
                        .foregroundStyle(unitCost > 0 ? .primary : Color(.tertiaryLabel))
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                }
                .padding(.horizontal).frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Divider().padding(.leading, 96)

            tapRow("Category", category ?? "None") { showCategory = true }
        }
    }

    /// The prominent, calculator-driven number row (Amount for money, Quantity for inventory).
    private func amountRow(_ name: String, value: Double, expr: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                label(name)
                Spacer()
                Text(value > 0 ? Money.grouped(value) : "0")
                    .font(.geist(21, .semibold)).monospacedDigit()
                    .foregroundStyle(value > 0 ? accent : Color(.tertiaryLabel))
            }
            .padding(.horizontal).frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func label(_ s: String) -> some View {
        Text(s).font(.geist(15)).foregroundStyle(.secondary).frame(width: 80, alignment: .leading)
    }

    private func controlRow<C: View>(_ name: String, @ViewBuilder _ content: () -> C) -> some View {
        HStack { label(name); Spacer(minLength: 12); content() }
            .padding(.horizontal).frame(maxWidth: .infinity, minHeight: 44)
    }

    private func fieldRow(_ name: String, _ placeholder: String, _ text: Binding<String>) -> some View {
        HStack { label(name); TextField(placeholder, text: text).multilineTextAlignment(.trailing) }
            .padding(.horizontal).frame(maxWidth: .infinity, minHeight: 44)
    }

    private func tapRow(_ name: String, _ value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                label(name)
                Spacer()
                Text(value).font(.geist(16))
                    .foregroundStyle(value == "None" ? Color(.tertiaryLabel) : .primary).lineLimit(1)
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.horizontal).frame(maxWidth: .infinity, minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Amount handling

    private func applyAmount(_ result: Double, _ expr: String) {
        amountExpr = expr
        if let (u, q) = Self.unitTimesQty(expr) {
            unitPrice = u; quantity = q
        } else {
            unitPrice = result; quantity = 1
        }
    }

    /// "1500000×6" -> (1500000, 6); anything else -> nil (store as flat total).
    static func unitTimesQty(_ expr: String) -> (Double, Double)? {
        guard !expr.contains("+"), !expr.contains("−"), !expr.contains("÷") else { return nil }
        let parts = expr.split(separator: "×")
        guard parts.count == 2, let a = Double(parts[0]), let b = Double(parts[1]) else { return nil }
        return (a, b)
    }

    private func save() {
        guard let siteId = appState.activeSiteId else { return }
        if isInventory {
            let name = itemName.trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty, quantity > 0 else { return }
            let item = InventoryItemPayload(
                site_id: siteId,
                name: name,
                quantity: quantity,
                category: category,
                sku: nil,
                unit: unit.trimmingCharacters(in: .whitespaces).isEmpty ? nil : unit,
                unit_cost: unitCost > 0 ? unitCost : nil,
                reorder_level: nil
            )
            outbox.enqueue(entity: "inventory_items", operation: .create, payload: item, siteId: siteId)
            dismiss()
            return
        }
        guard total > 0 else { return }
        let payload = TransactionPayload(
            site_id: siteId, type: type, status: status,
            quantity: quantity, unit_price: unitPrice,
            transaction_date: DateFmt.day(date),
            description: note.trimmingCharacters(in: .whitespaces).isEmpty ? nil : note,
            category: category,
            currency: "TZS",
            customer_id: customerId,
            phase_id: phaseId,
            reference_no: reference.trimmingCharacters(in: .whitespaces).isEmpty ? nil : reference
        )
        outbox.enqueue(entity: "transactions", operation: .create, payload: payload, siteId: siteId)
        dismiss()
    }

    // MARK: - Inline creation (from the pickers)

    /// Create a customer on the fly and select it. Offline-safe: a client UUID lets
    /// us use the row immediately while the outbox syncs it.
    private func createCustomer(_ raw: String) -> CustomerLite? {
        let n = raw.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty, let siteId = appState.activeSiteId, let orgId = appState.activeOrgId else { return nil }
        let id = UUID().uuidString.lowercased()
        let payload = CustomerCreatePayload(
            id: id, site_id: siteId, org_id: orgId, name: n,
            type: "external", status: "active",
            contact_phone: nil, daily_rate: nil, contract_start: nil, contract_end: nil, notes: nil
        )
        outbox.enqueue(entity: "customers", operation: .create, payload: payload, siteId: siteId)
        let lite = CustomerLite(id: id, name: n)
        model.customers.append(lite)
        model.customers.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        return lite
    }

    private func createPhase(_ raw: String) -> PhaseLite? {
        let n = raw.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty, let siteId = appState.activeSiteId, let orgId = appState.activeOrgId else { return nil }
        let id = UUID().uuidString.lowercased()
        let payload = PhaseCreatePayload(
            id: id, site_id: siteId, org_id: orgId, name: n,
            status: "open", start_date: DateFmt.day(Date())
        )
        outbox.enqueue(entity: "production_phases", operation: .create, payload: payload, siteId: siteId)
        let phase = PhaseLite(id: id, name: n, status: "open")
        model.phases.insert(phase, at: 0)   // newest open phase first
        return phase
    }
}

// MARK: - Calculator

/// Safe arithmetic on a controlled token string (digits and + − × ÷ . only).
enum CalcEngine {
    static func eval(_ raw: String) -> Double {
        var s = raw
            .replacingOccurrences(of: "×", with: "*")
            .replacingOccurrences(of: "÷", with: "/")
            .replacingOccurrences(of: "−", with: "-")
        while let last = s.last, "+-*/.".contains(last) { s.removeLast() }
        guard !s.isEmpty, s.allSatisfy({ "0123456789.+-*/".contains($0) }) else { return 0 }
        let value = NSExpression(format: s).expressionValue(with: nil, context: nil) as? NSNumber
        let d = value?.doubleValue ?? 0
        return d.isFinite ? d : 0
    }
}

struct CalculatorSheet: View {
    let accent: Color
    let onDone: (Double, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var expr: String

    init(accent: Color, initial: String, onDone: @escaping (Double, String) -> Void) {
        self.accent = accent; self.onDone = onDone
        _expr = State(initialValue: initial)
    }

    private var result: Double { CalcEngine.eval(expr) }
    private let rows = [
        ["+", "−", "×", "÷"],
        ["7", "8", "9", "="],
        ["4", "5", "6", "."],
        ["1", "2", "3", "⌫"],
        ["C", "0", "000", "OK"],
    ]

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .trailing, spacing: 2) {
                Text(expr.isEmpty ? " " : expr).font(.geist(14)).foregroundStyle(.secondary).lineLimit(1)
                Text(Money.grouped(result)).font(.geist(32, .semibold)).monospacedDigit().foregroundStyle(accent)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.horizontal).padding(.top, 18).padding(.bottom, 8)

            VStack(spacing: 1) {
                ForEach(rows.indices, id: \.self) { r in
                    HStack(spacing: 1) {
                        ForEach(rows[r], id: \.self) { key(  $0) }
                    }
                    .frame(height: 62)
                }
            }
            .background(Color(.separator))
        }
        .background(Color(.systemBackground))
    }

    private func key(_ k: String) -> some View {
        Button { tap(k) } label: {
            Group {
                if k == "⌫" { Image(systemName: "delete.left") } else { Text(k) }
            }
            .font(.geist(21, k == "OK" ? .semibold : .regular))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .foregroundStyle(fg(k))
            .background(bg(k))
        }
        .buttonStyle(.plain)
    }

    private func fg(_ k: String) -> Color {
        if k == "OK" { return .white }
        if "+−×÷=".contains(k) { return accent }
        if k == "C" || k == "⌫" { return .secondary }
        return .primary
    }
    private func bg(_ k: String) -> Color { k == "OK" ? accent : Color(.systemBackground) }

    private var endsWithOperator: Bool { expr.last.map { "+−×÷".contains($0) } ?? false }

    private func tap(_ k: String) {
        switch k {
        case "OK": onDone(result, expr); dismiss()
        case "C":  expr = ""
        case "⌫":  if !expr.isEmpty { expr.removeLast() }
        case "=":  expr = Money.plain(result)
        case "+", "−", "×", "÷":
            if expr.isEmpty { return }
            if endsWithOperator { expr.removeLast() }
            expr.append(k)
        case ".":
            let token = expr.split(whereSeparator: { "+−×÷".contains($0) }).last.map(String.init) ?? ""
            if !token.contains(".") { expr += token.isEmpty ? "0." : "." }
        case "000":
            if let last = expr.last, last.isNumber { expr += "000" }
        default:
            expr += k   // digit
        }
    }
}

// MARK: - Data loader

@MainActor
final class EntryPadModel: ObservableObject {
    @Published var customers: [CustomerLite] = []
    @Published var phases: [PhaseLite] = []
    @Published var categories: [String] = []

    func load(siteId: String) async {
        customers  = (try? await Lookups.customers(siteId: siteId)) ?? []
        phases     = (try? await Lookups.phases(siteId: siteId)) ?? []
        categories = (try? await Lookups.categories(siteId: siteId)) ?? []
    }
}

// MARK: - Picker sheets (compact bottom panels, MM-style grid)

private let pickCols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

private struct SheetHead: View {
    let title: String
    let onClose: () -> Void
    var body: some View {
        HStack {
            Text(title).font(.geist(16, .medium))
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill").font(.title3).foregroundStyle(Color(.tertiaryLabel))
            }
        }
        .padding(.horizontal).padding(.top, 18).padding(.bottom, 10)
    }
}

private struct PickChip: View {
    let text: String
    let selected: Bool
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(text).font(.geist(14)).lineLimit(1).foregroundStyle(selected ? Brand.teal : .primary)
                Spacer(minLength: 0)
                if selected { Image(systemName: "checkmark").font(.caption2).foregroundStyle(Brand.teal) }
            }
            .padding(.horizontal, 12).frame(height: 46)
            .background(RoundedRectangle(cornerRadius: 10)
                .fill(selected ? Brand.tealTint : Color(.secondarySystemBackground)))
        }
        .buttonStyle(.plain)
    }
}

private struct CategoryPickerSheet: View {
    let categories: [String]
    let selected: String?
    let onPick: (String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var custom = ""

    var body: some View {
        VStack(spacing: 0) {
            SheetHead(title: "Category") { dismiss() }
            HStack {
                TextField("New category", text: $custom).textFieldStyle(.roundedBorder)
                Button("Add") {
                    let v = custom.trimmingCharacters(in: .whitespaces); guard !v.isEmpty else { return }
                    onPick(v); dismiss()
                }.disabled(custom.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal).padding(.bottom, 10)
            ScrollView {
                LazyVGrid(columns: pickCols, spacing: 10) {
                    PickChip(text: "None", selected: selected == nil) { onPick(nil); dismiss() }
                    ForEach(categories, id: \.self) { c in
                        PickChip(text: c, selected: c == selected) { onPick(c); dismiss() }
                    }
                }
                .padding(.horizontal).padding(.bottom, 20)
            }
        }
    }
}

private struct CustomerPickerSheet: View {
    let customers: [CustomerLite]
    let selectedId: String?
    let onCreate: (String) -> CustomerLite?
    let onPick: (CustomerLite?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var newName = ""

    private var canAdd: Bool { !newName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            SheetHead(title: "Customer") { dismiss() }
            HStack {
                TextField("New customer", text: $newName).textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.words)
                Button("Add") {
                    if let c = onCreate(newName) { onPick(c); dismiss() }
                }.disabled(!canAdd)
            }
            .padding(.horizontal).padding(.bottom, 10)
            ScrollView {
                LazyVGrid(columns: pickCols, spacing: 10) {
                    PickChip(text: "None", selected: selectedId == nil) { onPick(nil); dismiss() }
                    ForEach(customers) { c in
                        PickChip(text: c.name, selected: c.id == selectedId) { onPick(c); dismiss() }
                    }
                }
                .padding(.horizontal).padding(.bottom, 20)
            }
        }
    }
}

private struct PhasePickerSheet: View {
    let phases: [PhaseLite]
    let selectedId: String?
    let onCreate: (String) -> PhaseLite?
    let onPick: (PhaseLite?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var newName = ""

    private var canAdd: Bool { !newName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            SheetHead(title: "Phase") { dismiss() }
            HStack {
                TextField("New phase (e.g. Awamu 3)", text: $newName).textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.words)
                Button("Add") {
                    if let p = onCreate(newName) { onPick(p); dismiss() }
                }.disabled(!canAdd)
            }
            .padding(.horizontal).padding(.bottom, 10)
            ScrollView {
                LazyVGrid(columns: pickCols, spacing: 10) {
                    PickChip(text: "None", selected: selectedId == nil) { onPick(nil); dismiss() }
                    ForEach(phases) { p in
                        PickChip(text: p.name, selected: p.id == selectedId) { onPick(p); dismiss() }
                    }
                }
                .padding(.horizontal).padding(.bottom, 20)
            }
        }
    }
}
