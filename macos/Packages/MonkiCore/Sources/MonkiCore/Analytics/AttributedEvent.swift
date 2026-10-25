// SPDX-License-Identifier: AGPL-3.0-or-later

/// A categorised, non-idle stretch of time ready to be cut into blocks
/// (`activity.schema.json#/$defs/attributedEvent`). `title` and `url` may
/// exist locally and never reach a block.
public struct AttributedEvent: Hashable, Sendable, Codable {
    public var timestamp: String
    public var duration: Int
    public var source: ActivitySource
    public var activityKey: String
    public var categoryPath: String
    public var level: Int
    public var title: String?
    public var url: String?

    public init(
        timestamp: String,
        duration: Int,
        source: ActivitySource,
        activityKey: String,
        categoryPath: String,
        level: Int,
        title: String? = nil,
        url: String? = nil
    ) {
        self.timestamp = timestamp
        self.duration = duration
        self.source = source
        self.activityKey = activityKey
        self.categoryPath = categoryPath
        self.level = level
        self.title = title
        self.url = url
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case timestamp, duration, source, activityKey, categoryPath, level, title, url
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        timestamp = try container.decode(String.self, forKey: .timestamp)
        duration = try container.decode(Int.self, forKey: .duration)
        source = try container.decode(ActivitySource.self, forKey: .source)
        activityKey = try container.decode(String.self, forKey: .activityKey)
        categoryPath = try container.decode(String.self, forKey: .categoryPath)
        level = try container.decode(Int.self, forKey: .level)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        url = try container.decodeIfPresent(String.self, forKey: .url)
    }
}
