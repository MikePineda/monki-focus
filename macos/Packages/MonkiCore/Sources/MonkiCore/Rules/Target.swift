// SPDX-License-Identifier: AGPL-3.0-or-later

/// What a rule, category assignment or unlock applies to (`target.schema.json`):
/// an app (Android package or macOS bundle id), a site (domain plus an
/// optional path glob) or a surface.
public enum Target: Hashable, Sendable, Codable {
    case app(package: String)
    case site(domain: String, path: String?)
    case surface(String)

    private enum Keys: String, CodingKey, CaseIterable {
        case kind, package, domain, path, surface
    }

    private enum AppKeys: String, CodingKey, CaseIterable {
        case kind, package
    }

    private enum SiteKeys: String, CodingKey, CaseIterable {
        case kind, domain, path
    }

    private enum SurfaceKeys: String, CodingKey, CaseIterable {
        case kind, surface
    }

    public init(from decoder: any Decoder) throws {
        let kind = try decoder.container(keyedBy: Keys.self).decode(String.self, forKey: .kind)
        switch kind {
        case "app":
            let container = try decoder.strictContainer(keyedBy: AppKeys.self)
            self = .app(package: try container.decode(String.self, forKey: .package))
        case "site":
            let container = try decoder.strictContainer(keyedBy: SiteKeys.self)
            self = .site(
                domain: try container.decode(String.self, forKey: .domain),
                path: try container.decodeIfPresent(String.self, forKey: .path)
            )
        case "surface":
            let container = try decoder.strictContainer(keyedBy: SurfaceKeys.self)
            self = .surface(try container.decode(String.self, forKey: .surface))
        default:
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unknown target kind")
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Keys.self)
        switch self {
        case .app(let package):
            try container.encode("app", forKey: .kind)
            try container.encode(package, forKey: .package)
        case .site(let domain, let path):
            try container.encode("site", forKey: .kind)
            try container.encode(domain, forKey: .domain)
            try container.encodeIfPresent(path, forKey: .path)
        case .surface(let surface):
            try container.encode("surface", forKey: .kind)
            try container.encode(surface, forKey: .surface)
        }
    }
}
