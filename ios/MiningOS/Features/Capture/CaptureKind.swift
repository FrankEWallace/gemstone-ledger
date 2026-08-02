import SwiftUI

/// The four things a field user captures. Drives the Home grid.
enum CaptureKind: String, CaseIterable, Identifiable {
    case production
    case transaction
    case inventory
    case safety

    var id: String { rawValue }

    var title: String {
        switch self {
        case .production:  return "Log Production"
        case .transaction: return "Record Sale / Expense"
        case .inventory:   return "Add Inventory"
        case .safety:      return "Report Incident"
        }
    }

    var systemImage: String {
        switch self {
        case .production:  return "pickaxe"
        case .transaction: return "arrow.left.arrow.right"
        case .inventory:   return "shippingbox"
        case .safety:      return "exclamationmark.shield"
        }
    }

    var tint: Color {
        switch self {
        case .production:  return .orange
        case .transaction: return .green
        case .inventory:   return .blue
        case .safety:      return .red
        }
    }
}
