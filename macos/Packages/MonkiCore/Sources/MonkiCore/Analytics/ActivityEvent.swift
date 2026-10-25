// SPDX-License-Identifier: AGPL-3.0-or-later

/// `activity.schema.json#/$defs/event`: an ActivityWatch event
/// `{timestamp, duration, data}` with a UTC instant
/// (`2026-10-25T23:00:00Z`) and a whole-second duration (SEMANTICS.md §10).
public struct ActivityEvent: Hashable, Sendable, Codable {
    public var timestamp: String
    public var duration: Int
    public var data: EventData

    public init(timestamp: String, duration: Int, data: EventData) {
        self.timestamp = timestamp
        self.duration = duration
        self.data = data
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case timestamp, duration, data
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        timestamp = try container.decode(String.self, forKey: .timestamp)
        duration = try container.decode(Int.self, forKey: .duration)
        data = try container.decode(EventData.self, forKey: .data)
    }

    /// The event as the half-open interval `[timestamp, timestamp + duration)` in epoch seconds.
    func interval() throws(EngineError) -> Interval {
        let start = try epochSecondsOf(timestamp)
        return Interval(start: start, end: start + duration)
    }
}
