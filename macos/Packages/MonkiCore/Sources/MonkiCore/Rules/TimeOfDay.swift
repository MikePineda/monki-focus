// SPDX-License-Identifier: AGPL-3.0-or-later

/// A local wall-clock time `HH:MM` (24-hour), as schedules and bedtime
/// write it. Decoding rejects anything else, so a window is always well formed.
public struct TimeOfDay: Hashable, Sendable, Codable, CustomStringConvertible {
    /// Minutes since midnight, 0…1439.
    public let minutes: Int

    public init?(_ text: String) {
        let scalars = Array(text.unicodeScalars)
        guard scalars.count == 5, scalars[2] == ":",
            let hour = Self.twoDigits(scalars[0], scalars[1]),
            let minute = Self.twoDigits(scalars[3], scalars[4]),
            hour < 24, minute < 60
        else { return nil }
        minutes = hour * 60 + minute
    }

    /// A time of day from its fields; out-of-range values are a programming error and trap.
    public init(hour: Int, minute: Int) {
        precondition((0..<24).contains(hour) && (0..<60).contains(minute), "not a time of day")
        minutes = hour * 60 + minute
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let parsed = TimeOfDay(text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Not a HH:MM time of day")
        }
        self = parsed
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(description)
    }

    public var description: String {
        let hour = minutes / 60
        let minute = minutes % 60
        return (hour < 10 ? "0" : "") + String(hour) + ":" + (minute < 10 ? "0" : "") + String(minute)
    }

    private static func twoDigits(_ tens: Unicode.Scalar, _ ones: Unicode.Scalar) -> Int? {
        guard ("0"..."9").contains(tens), ("0"..."9").contains(ones) else { return nil }
        return Int(tens.value - 48) * 10 + Int(ones.value - 48)
    }
}
