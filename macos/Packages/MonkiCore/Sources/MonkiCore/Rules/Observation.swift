// SPDX-License-Identifier: AGPL-3.0-or-later

/// What the user is about to see (`decision-context.schema.json#/$defs/observation`):
/// raw URL text, normalised by the engine, or an app with the surface its
/// detector resolved.
public enum Observation: Hashable, Sendable, Codable {
    case site(urlText: String)
    case app(package: String, surface: String?)

    private enum Keys: String, CodingKey, CaseIterable {
        case kind, urlText, package, surface
    }

    private enum SiteKeys: String, CodingKey, CaseIterable {
        case kind, urlText
    }

    private enum AppKeys: String, CodingKey, CaseIterable {
        case kind, package, surface
    }

    public init(from decoder: any Decoder) throws {
        let kind = try decoder.container(keyedBy: Keys.self).decode(String.self, forKey: .kind)
        switch kind {
        case "site":
            let container = try decoder.strictContainer(keyedBy: SiteKeys.self)
            self = .site(urlText: try container.decode(String.self, forKey: .urlText))
        case "app":
            let container = try decoder.strictContainer(keyedBy: AppKeys.self)
            self = .app(
                package: try container.decode(String.self, forKey: .package),
                surface: try container.decodeNullable(String.self, forKey: .surface)
            )
        default:
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unknown observation kind")
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: Keys.self)
        switch self {
        case .site(let urlText):
            try container.encode("site", forKey: .kind)
            try container.encode(urlText, forKey: .urlText)
        case .app(let package, let surface):
            try container.encode("app", forKey: .kind)
            try container.encode(package, forKey: .package)
            try container.encode(surface, forKey: .surface)
        }
    }
}
