// SPDX-License-Identifier: AGPL-3.0-or-later

/// A weekly window `{days, start, end}` in local wall-clock time
/// (`schedule.schema.json`). `end <= start` crosses midnight; `end == start`
/// is a full 24 hours. A window belongs to the day it starts on.
public struct Schedule: Hashable, Sendable, Codable {
    public var days: [Weekday]
    public var start: TimeOfDay
    public var end: TimeOfDay

    public init(days: [Weekday], start: TimeOfDay, end: TimeOfDay) {
        self.days = days
        self.start = start
        self.end = end
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case days, start, end
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        days = try container.decode([Weekday].self, forKey: .days)
        start = try container.decode(TimeOfDay.self, forKey: .start)
        end = try container.decode(TimeOfDay.self, forKey: .end)
    }
}
