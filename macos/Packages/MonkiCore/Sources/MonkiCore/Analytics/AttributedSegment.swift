// SPDX-License-Identifier: AGPL-3.0-or-later

/// Output of browser dedupe (`activity.schema.json#/$defs/segment`): who the
/// half-open stretch `[start, end)` belongs to.
public struct AttributedSegment: Hashable, Sendable, Codable {
    public var start: String
    public var end: String
    public var source: ActivitySource
    public var activityKey: String

    public init(start: String, end: String, source: ActivitySource, activityKey: String) {
        self.start = start
        self.end = end
        self.source = source
        self.activityKey = activityKey
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case start, end, source, activityKey
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        start = try container.decode(String.self, forKey: .start)
        end = try container.decode(String.self, forKey: .end)
        source = try container.decode(ActivitySource.self, forKey: .source)
        activityKey = try container.decode(String.self, forKey: .activityKey)
    }
}
