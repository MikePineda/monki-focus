// SPDX-License-Identifier: AGPL-3.0-or-later

/// What categorisation sees (`activity.schema.json#/$defs/activity`, SEMANTICS.md §9):
/// `activityKey` is the normalised domain (web) or the bundle id or package
/// (app); `path` is nil when the web path is unknown.
public struct CategorisableActivity: Hashable, Sendable, Codable {
    public var source: ActivitySource
    public var activityKey: String
    public var path: String?
    public var surface: String?

    public init(source: ActivitySource, activityKey: String, path: String?, surface: String?) {
        self.source = source
        self.activityKey = activityKey
        self.path = path
        self.surface = surface
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case source, activityKey, path, surface
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        source = try container.decode(ActivitySource.self, forKey: .source)
        activityKey = try container.decode(String.self, forKey: .activityKey)
        path = try container.decodeNullable(String.self, forKey: .path)
        surface = try container.decodeNullable(String.self, forKey: .surface)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(source, forKey: .source)
        try container.encode(activityKey, forKey: .activityKey)
        try container.encode(path, forKey: .path)
        try container.encode(surface, forKey: .surface)
    }
}
