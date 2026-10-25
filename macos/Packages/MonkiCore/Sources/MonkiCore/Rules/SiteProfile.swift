// SPDX-License-Identifier: AGPL-3.0-or-later

/// URL paths of one site mapped to surfaces (`site-profile.schema.json`,
/// `data/sites/<domain>.json`). `aliases` are rewritten to `domain`.
public struct SiteProfile: Hashable, Sendable, Codable {
    public var schemaVersion: Int
    public var domain: String
    public var aliases: [String]
    public var spaNavigation: String
    /// Surface id → the path globs that resolve to it.
    public var surfaces: [String: [String]]

    public init(
        schemaVersion: Int = 1,
        domain: String,
        aliases: [String],
        spaNavigation: String,
        surfaces: [String: [String]]
    ) {
        self.schemaVersion = schemaVersion
        self.domain = domain
        self.aliases = aliases
        self.spaNavigation = spaNavigation
        self.surfaces = surfaces
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case schemaVersion, domain, aliases, spaNavigation, surfaces
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        domain = try container.decode(String.self, forKey: .domain)
        aliases = try container.decode([String].self, forKey: .aliases)
        spaNavigation = try container.decode(String.self, forKey: .spaNavigation)
        surfaces = try container.decode([String: [String]].self, forKey: .surfaces)
    }
}
