import SwiftUI

/// Row of three stat boxes (week / month / year) computed relative to `referenceDate`.
/// Each box shows total hours, with an "X OT" subtitle if any overtime was logged.
struct WeekSummaryCard: View {
    let entries: [TimeEntry]
    let referenceDate: Date

    private let calendar = Calendar.current

    var body: some View {
        HStack(spacing: 12) {
            StatBox(title: "Week", hours: total(of: weekEntries), subtitle: overtimeSubtitle(weekEntries))
            StatBox(title: "Month", hours: total(of: monthEntries), subtitle: overtimeSubtitle(monthEntries))
            StatBox(title: "Year", hours: total(of: yearEntries), subtitle: overtimeSubtitle(yearEntries))
        }
    }

    private var weekEntries: [TimeEntry] {
        entries.filter {
            calendar.isDate($0.date, equalTo: referenceDate, toGranularity: .weekOfYear) &&
            calendar.isDate($0.date, equalTo: referenceDate, toGranularity: .yearForWeekOfYear)
        }
    }

    private var monthEntries: [TimeEntry] {
        entries.filter {
            calendar.isDate($0.date, equalTo: referenceDate, toGranularity: .month) &&
            calendar.isDate($0.date, equalTo: referenceDate, toGranularity: .year)
        }
    }

    private var yearEntries: [TimeEntry] {
        entries.filter {
            calendar.isDate($0.date, equalTo: referenceDate, toGranularity: .year)
        }
    }

    private func total(of items: [TimeEntry]) -> Double {
        items.reduce(0) { $0 + $1.hours }
    }

    private func overtimeSubtitle(_ items: [TimeEntry]) -> String? {
        let overtime = items.reduce(0) { $0 + $1.overtimeHours }
        guard overtime > 0 else { return nil }
        let formatted = overtime.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", overtime)
            : String(format: "%.1f", overtime)
        return "\(formatted) OT"
    }
}

struct StatBox: View {
    let title: String
    let hours: Double
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 4) {
            Text(formattedHours)
                .font(.title3.bold().monospacedDigit())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            if let subtitle {
                Text(subtitle)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.orange)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var formattedHours: String {
        hours.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", hours)
            : String(format: "%.1f", hours)
    }
}
