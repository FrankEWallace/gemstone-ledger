import Foundation

enum DateFmt {
    /// Postgres `date` column format, e.g. "2026-08-02".
    static let isoDay: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .iso8601)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func day(_ date: Date) -> String { isoDay.string(from: date) }

    /// Parses a Postgres `date` string ("yyyy-MM-dd") back into a Date; nil if malformed.
    static func parseDay(_ s: String) -> Date? { isoDay.date(from: s) }
}

extension String {
    /// Parses a decimal text field, treating empty/invalid as nil.
    var optionalDouble: Double? {
        // Tolerate grouping separators from money fields (e.g. "6,000").
        let trimmed = trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        return trimmed.isEmpty ? nil : Double(trimmed)
    }
}
