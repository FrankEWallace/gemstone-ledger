import SwiftUI

/// Shared brand tokens. Teal (#0F6E56) mirrors the web app's --primary.
/// Geist (OFL) is bundled — see Resources/Fonts + UIAppFonts in project.yml.
extension Font {
    /// Geist by PostScript name; only Regular/Medium/SemiBold weights are bundled.
    static func geist(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .medium:               name = "Geist-Medium"
        case .semibold, .bold, .heavy, .black: name = "Geist-SemiBold"
        default:                    name = "Geist-Regular"
        }
        return .custom(name, size: size)
    }
}

enum Brand {
    static let teal = Color(red: 0x0F / 255, green: 0x6E / 255, blue: 0x56 / 255)
    static let tealDeep = Color(red: 0x0A / 255, green: 0x4C / 255, blue: 0x3B / 255)
    static let tealTint = teal.opacity(0.12)

    static let expenseRed = Color(red: 0.83, green: 0.24, blue: 0.16)
    static let inventoryBlue = Color(red: 0.13, green: 0.45, blue: 0.82)

    /// Semantic tint per entry type (income = teal, expense = red, inventory = blue).
    static func typeColor(_ type: String) -> Color {
        switch type {
        case "income":    return teal
        case "inventory": return inventoryBlue
        default:          return expenseRed   // expense
        }
    }
}

/// TZS-first money formatting: grouped integers, no decimals (shillings rarely
/// use them). Currency code shown separately so the number stays the hero.
enum Money {
    private static let fmt: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.groupingSeparator = ","
        return f
    }()

    static func grouped(_ value: Double) -> String {
        fmt.string(from: NSNumber(value: value)) ?? "0"
    }

    /// No separators — used to fold a calculator "=" result back into an expression.
    static func plain(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }

    /// Abbreviated magnitude for tight spaces (calendar cells): 43M, 1.1M, 145K.
    static func compact(_ value: Double) -> String {
        let v = abs(value)
        func trim(_ s: String) -> String { s.hasSuffix(".0") ? String(s.dropLast(2)) : s }
        switch v {
        case 1_000_000_000...: return trim(String(format: "%.1f", v / 1_000_000_000)) + "B"
        case 1_000_000...:     return trim(String(format: "%.1f", v / 1_000_000)) + "M"
        case 1_000...:         return String(format: "%.0f", v / 1_000) + "K"
        default:               return String(format: "%.0f", v)
        }
    }
}
