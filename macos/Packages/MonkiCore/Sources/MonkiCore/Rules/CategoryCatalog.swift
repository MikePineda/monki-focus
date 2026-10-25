// SPDX-License-Identifier: AGPL-3.0-or-later

/// The factory category assignments (`data/categories/default.json`).
public struct CategoryCatalog: Hashable, Sendable, Codable {
    public var schemaVersion: Int
    public var assignments: [CategoryAssignment]

    public init(schemaVersion: Int = 1, assignments: [CategoryAssignment]) {
        self.schemaVersion = schemaVersion
        self.assignments = assignments
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case schemaVersion, assignments
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        assignments = try container.decode([CategoryAssignment].self, forKey: .assignments)
    }
}
