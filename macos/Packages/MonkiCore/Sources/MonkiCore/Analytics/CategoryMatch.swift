// SPDX-License-Identifier: AGPL-3.0-or-later

/// The outcome of `categorise` (`activity.schema.json#/$defs/categoryMatch`):
/// a productivity level (0, 25, 50, 75 or 100) and a category path.
public struct CategoryMatch: Hashable, Sendable, Codable {
    public var level: Int
    public var categoryPath: String

    public init(level: Int, categoryPath: String) {
        self.level = level
        self.categoryPath = categoryPath
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case level, categoryPath
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        level = try container.decode(Int.self, forKey: .level)
        categoryPath = try container.decode(String.self, forKey: .categoryPath)
    }
}
