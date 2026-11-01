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
    /// A short-video surface (Reels, Shorts) that relaxed weekends soften (§6.4); absent means false.
    public var shortVideo: Bool

    public init(id: String, family: String, kind: SurfaceKind, shortVideo: Bool = false) {
        self.id = id
        self.family = family
        self.kind = kind
        self.shortVideo = shortVideo
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case id, family, kind, shortVideo
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        family = try container.decode(String.self, forKey: .family)
        kind = try container.decode(SurfaceKind.self, forKey: .kind)
        shortVideo = try container.decodeIfPresent(Bool.self, forKey: .shortVideo) ?? false
    }

    /// Writes `shortVideo` only when true, so a registry without it round-trips unchanged.
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(family, forKey: .family)
        try container.encode(kind, forKey: .kind)
        if shortVideo { try container.encode(true, forKey: .shortVideo) }
    }
}
