// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// Instants (SEMANTICS.md §1). Inputs MUST be RFC 3339 with an explicit offset
// or `Z` and whole seconds (the schema pattern); a floating local time or any
// other text is invalid input and throws, which `decide` turns into a
// fail-closed decision (§14). Parsing is strict on purpose: `ISO8601DateFormatter`
// accepts more (fractions, offsets without a colon). Every computed instant is
// written in UTC with `Z` and no fractional seconds, so fixtures compare as
// strings. The engine works in whole epoch seconds internally.

let secondsPerDay = 86_400

/// Whole seconds since the Unix epoch of an RFC 3339 instant with an explicit offset.
public func epochSecondsOf(_ instant: String) throws(EngineError) -> Int {
    let scalars = Array(instant.unicodeScalars)
    guard scalars.count == 20 || scalars.count == 25 else { throw .invalidInstant }
    func number(_ range: Range<Int>) throws(EngineError) -> Int {
        var value = 0
        for index in range {
            let scalar = scalars[index]
            guard ("0"..."9").contains(scalar) else { throw .invalidInstant }
            value = value * 10 + Int(scalar.value - 48)
        }
        return value
    }
    guard scalars[4] == "-", scalars[7] == "-", scalars[10] == "T", scalars[13] == ":", scalars[16] == ":" else {
        throw .invalidInstant
    }
    var year = try number(0..<4)
    let month = try number(5..<7)
    let day = try number(8..<10)
    let hour = try number(11..<13)
    let minute = try number(14..<16)
    let second = try number(17..<19)
    var offsetSeconds = 0
    if scalars.count == 20 {
        guard scalars[19] == "Z" else { throw .invalidInstant }
    } else {
        guard scalars[19] == "+" || scalars[19] == "-", scalars[22] == ":" else { throw .invalidInstant }
        let offsetHours = try number(20..<22)
        let offsetMinutes = try number(23..<25)
        guard offsetHours <= 23, offsetMinutes <= 59 else { throw .invalidInstant }
        offsetSeconds = (scalars[19] == "-" ? -1 : 1) * (offsetHours * 3600 + offsetMinutes * 60)
    }
    guard hour <= 23, minute <= 59, second <= 59 else { throw .invalidInstant }
    // The TypeScript engine reads the fields with `Date.UTC`, which maps years 0…99 to 1900…1999.
    if year < 100 { year += 1900 }
    // Rejects month 13, 31 April and the like instead of rolling them over.
    guard (1...12).contains(month), (1...CivilDate.daysIn(year: year, month: month)).contains(day) else {
        throw .invalidInstant
    }
    let wall =
        CivilDate.dayNumber(year: year, month: month, day: day) * secondsPerDay + hour * 3600 + minute * 60
        + second
    return wall - offsetSeconds
}

/// The canonical UTC form (`2026-10-25T23:00:00Z`) of whole epoch seconds.
public func utcInstantOf(_ epochSeconds: Int) -> String {
    let day = floorDivision(epochSeconds, secondsPerDay)
    let rest = epochSeconds - day * secondsPerDay
    return CivilDate.isoDate(ofDayNumber: day) + "T" + twoDigits(rest / 3600) + ":" + twoDigits(rest % 3600 / 60)
        + ":" + twoDigits(rest % 60) + "Z"
}

/// The `now` adapters pass to the engine: `instantOf(epochMillis: clock reading)`.
/// Floors to whole seconds (text with fractions is invalid input and would
/// fail closed). A negative or non-finite value is an adapter bug and throws.
public func instantOf(epochMillis: Double) throws(EngineError) -> String {
    guard epochMillis.isFinite, epochMillis >= 0, epochMillis < 253_402_300_800_000 else {
        throw .invalidArgument
    }
    return utcInstantOf(Int((epochMillis / 1000).rounded(.down)))
}

/// `instantOf(epochMillis:)` for a `Date` read from an injected `Clock`.
public func instantOf(_ date: Date) throws(EngineError) -> String {
    try instantOf(epochMillis: (date.timeIntervalSince1970 * 1000).rounded(.down))
}

/// Floor division (towards negative infinity), as `Math.floor(a / b)`.
func floorDivision(_ dividend: Int, _ divisor: Int) -> Int {
    let quotient = dividend / divisor
    return (dividend % divisor != 0 && (dividend < 0) != (divisor < 0)) ? quotient - 1 : quotient
}

func twoDigits(_ value: Int) -> String {
    value < 10 ? "0" + String(value) : String(value)
}
