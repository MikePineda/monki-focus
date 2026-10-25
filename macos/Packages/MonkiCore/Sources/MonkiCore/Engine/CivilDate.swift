// SPDX-License-Identifier: AGPL-3.0-or-later

/// Proleptic Gregorian calendar arithmetic on day numbers (days since
/// 1970-01-01), without `Calendar`, so a local date never depends on the
/// device's calendar or locale (H. Hinnant's civil-from-days algorithms).
enum CivilDate {
    static func isLeap(_ year: Int) -> Bool {
        year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
    }

    static func daysIn(year: Int, month: Int) -> Int {
        switch month {
        case 2: isLeap(year) ? 29 : 28
        case 4, 6, 9, 11: 30
        default: 31
        }
    }

    static func dayNumber(year: Int, month: Int, day: Int) -> Int {
        let shifted = month <= 2 ? year - 1 : year
        let era = floorDivision(shifted, 400)
        let yearOfEra = shifted - era * 400
        let dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
        let dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
        return era * 146_097 + dayOfEra - 719_468
    }

    static func civil(ofDayNumber dayNumber: Int) -> (year: Int, month: Int, day: Int) {
        let shifted = dayNumber + 719_468
        let era = floorDivision(shifted, 146_097)
        let dayOfEra = shifted - era * 146_097
        let yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146_096) / 365
        let dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
        let monthIndex = (5 * dayOfYear + 2) / 153
        let day = dayOfYear - (153 * monthIndex + 2) / 5 + 1
        let month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9
        return (yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day)
    }

    /// `YYYY-MM-DD` of a day number.
    static func isoDate(ofDayNumber dayNumber: Int) -> String {
        let (year, month, day) = civil(ofDayNumber: dayNumber)
        let digits = String(abs(year))
        let paddedYear = String(repeating: "0", count: max(0, 4 - digits.count)) + digits
        return (year < 0 ? "-" : "") + paddedYear + "-" + twoDigits(month) + "-" + twoDigits(day)
    }
}
