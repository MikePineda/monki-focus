// SPDX-License-Identifier: AGPL-3.0-or-later

/// The nightly window that blocks distracting targets (`bedtime.schema.json`).
/// `days` are the days the window starts on.
public struct Bedtime: Hashable, Sendable, Codable {
    public var enabled: Bool
    public var days: [Weekday]
    public var start: TimeOfDay
    public var end: TimeOfDay
    public var warnMinutesBefore: Int

    public init(enabled: Bool, days: [Weekday], start: TimeOfDay, end: TimeOfDay, warnMinutesBefore: Int) {
        self.enabled = enabled
        self.days = days
        self.start = start
        self.end = end
        self.warnMinutesBefore = warnMinutesBefore
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case enabled, days, start, end, warnMinutesBefore
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        enabled = try container.decode(Bool.self, forKey: .enabled)
        days = try container.decode([Weekday].self, forKey: .days)
        start = try container.decode(TimeOfDay.self, forKey: .start)
        end = try container.decode(TimeOfDay.self, forKey: .end)
        warnMinutesBefore = try container.decode(Int.self, forKey: .warnMinutesBefore)
    }

    /// The window as a schedule (the days, start and end without the warning).
    var window: Schedule { Schedule(days: days, start: start, end: end) }
}
