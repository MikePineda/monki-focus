// SPDX-License-Identifier: AGPL-3.0-or-later

/// A category and a productivity level for a target
/// (`category-assignment.schema.json`). Levels are 0, 25, 50, 75 and 100
/// (0 = very distracting); uncategorised activity is 50.
public struct CategoryAssignment: Hashable, Sendable, Codable {
    public var target: Target
    public var level: Int
    public var category: String

    public init(target: Target, level: Int, category: String) {
        self.target = target
        self.level = level
        self.category = category
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case target, level, category
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        target = try container.decode(Target.self, forKey: .target)
        level = try container.decode(Int.self, forKey: .level)
        category = try container.decode(String.self, forKey: .category)
    }
}
