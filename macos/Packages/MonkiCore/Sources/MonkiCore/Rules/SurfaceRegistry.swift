// SPDX-License-Identifier: AGPL-3.0-or-later

/// The canonical list of surfaces (`data/surfaces.json`).
public struct SurfaceRegistry: Hashable, Sendable, Codable {
    public var schemaVersion: Int
    public var surfaces: [Surface]

    public init(schemaVersion: Int = 1, surfaces: [Surface]) {
        self.schemaVersion = schemaVersion
        self.surfaces = surfaces
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case schemaVersion, surfaces
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        surfaces = try container.decode([Surface].self, forKey: .surfaces)
    }
}
