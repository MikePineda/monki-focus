// SPDX-License-Identifier: AGPL-3.0-or-later

/// `feed` can be hidden; `permalink` and `utility` (search, messages) are never hidden.
public enum SurfaceKind: String, Codable, CaseIterable, Sendable {
    case feed
    case permalink
    case utility
}

/// One registered surface (`surface-registry.schema.json#/$defs/surface`).
public struct Surface: Hashable, Sendable, Codable {
    public var id: String
    public var family: String
    public var kind: SurfaceKind

    public init(id: String, family: String, kind: SurfaceKind) {
        self.id = id
        self.family = family
        self.kind = kind
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case id, family, kind
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        family = try container.decode(String.self, forKey: .family)
        kind = try container.decode(SurfaceKind.self, forKey: .kind)
    }
}
