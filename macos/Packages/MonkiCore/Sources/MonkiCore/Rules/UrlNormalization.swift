// SPDX-License-Identifier: AGPL-3.0-or-later

/// Why URL text was rejected (§2).
public enum UrlRejection: String, Codable, CaseIterable, Sendable {
    case notHttp = "not_http"
    case invalidHost = "invalid_host"
}

/// The outcome of `normalizeUrl` (SEMANTICS.md §2): `{host, path, pathKnown,
/// surface}` or `{rejected}`.
public enum UrlNormalization: Hashable, Sendable, Codable {
    case normalized(host: String, path: String, pathKnown: Bool, surface: String?)
    case rejected(UrlRejection)

    private enum NormalizedKeys: String, CodingKey, CaseIterable {
        case host, path, pathKnown, surface
    }

    private enum RejectedKeys: String, CodingKey, CaseIterable {
        case rejected
    }

    public init(from decoder: any Decoder) throws {
        let keys = try decoder.container(keyedBy: AnyCodingKey.self)
        if keys.contains(AnyCodingKey(stringValue: "rejected")) {
            let container = try decoder.strictContainer(keyedBy: RejectedKeys.self)
            self = .rejected(try container.decode(UrlRejection.self, forKey: .rejected))
            return
        }
        let container = try decoder.strictContainer(keyedBy: NormalizedKeys.self)
        self = .normalized(
            host: try container.decode(String.self, forKey: .host),
            path: try container.decode(String.self, forKey: .path),
            pathKnown: try container.decode(Bool.self, forKey: .pathKnown),
            surface: try container.decodeNullable(String.self, forKey: .surface)
        )
    }

    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .normalized(let host, let path, let pathKnown, let surface):
            var container = encoder.container(keyedBy: NormalizedKeys.self)
            try container.encode(host, forKey: .host)
            try container.encode(path, forKey: .path)
            try container.encode(pathKnown, forKey: .pathKnown)
            try container.encode(surface, forKey: .surface)
        case .rejected(let reason):
            var container = encoder.container(keyedBy: RejectedKeys.self)
            try container.encode(reason, forKey: .rejected)
        }
    }
}
