// SPDX-License-Identifier: AGPL-3.0-or-later

/// An active stretch of time and its category level, the input of daily totals (SEMANTICS.md §10.7).
public struct LevelledInterval: Hashable, Sendable, Codable {
    public var timestamp: String
    public var duration: Int
    public var level: Int

    public init(timestamp: String, duration: Int, level: Int) {
        self.timestamp = timestamp
        self.duration = duration
        self.level = level
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case timestamp, duration, level
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        timestamp = try container.decode(String.self, forKey: .timestamp)
        duration = try container.decode(Int.self, forKey: .duration)
        level = try container.decode(Int.self, forKey: .level)
    }
}
