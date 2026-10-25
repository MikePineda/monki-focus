// SPDX-License-Identifier: AGPL-3.0-or-later

/// One local date's active time (`activity.schema.json#/$defs/dailyTotal`):
/// the total, the seconds by level and the pulse.
public struct DailyTotal: Hashable, Sendable, Codable {
    /// `YYYY-MM-DD` in the user's pinned zone.
    public var date: String
    public var seconds: Int
    public var secondsByLevel: SecondsByLevel
    public var pulse: Int?

    public init(date: String, seconds: Int, secondsByLevel: SecondsByLevel, pulse: Int?) {
        self.date = date
        self.seconds = seconds
        self.secondsByLevel = secondsByLevel
        self.pulse = pulse
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case date, seconds, secondsByLevel, pulse
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        date = try container.decode(String.self, forKey: .date)
        seconds = try container.decode(Int.self, forKey: .seconds)
        secondsByLevel = try container.decode(SecondsByLevel.self, forKey: .secondsByLevel)
        pulse = try container.decodeNullable(Int.self, forKey: .pulse)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(date, forKey: .date)
        try container.encode(seconds, forKey: .seconds)
        try container.encode(secondsByLevel, forKey: .secondsByLevel)
        try container.encode(pulse, forKey: .pulse)
    }
}

/// Seconds per productivity level (`activity.schema.json#/$defs/secondsByLevel`),
/// written as `{"0": …, "25": …, "50": …, "75": …, "100": …}`.
public struct SecondsByLevel: Hashable, Sendable, Codable {
    /// Seconds in level order 0, 25, 50, 75, 100.
    public private(set) var seconds: [Int]

    public init() {
        seconds = categoryLevels.map { _ in 0 }
    }

    /// The seconds at a level (0 for a level that is not one of the five).
    public subscript(level: Int) -> Int {
        categoryLevels.firstIndex(of: level).map { seconds[$0] } ?? 0
    }

    mutating func add(_ value: Int, at level: Int) throws(AnalyticsError) {
        guard let index = categoryLevels.firstIndex(of: level) else { throw .invalidLevel(level) }
        seconds[index] += value
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: LevelKey.self)
        seconds = try LevelKey.allCases.map { try container.decode(Int.self, forKey: $0) }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: LevelKey.self)
        for (key, value) in zip(LevelKey.allCases, seconds) {
            try container.encode(value, forKey: key)
        }
    }

    private enum LevelKey: String, CodingKey, CaseIterable {
        case level0 = "0"
        case level25 = "25"
        case level50 = "50"
        case level75 = "75"
        case level100 = "100"
    }
}
