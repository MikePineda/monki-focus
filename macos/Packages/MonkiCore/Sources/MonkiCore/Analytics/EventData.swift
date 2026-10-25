// SPDX-License-Identifier: AGPL-3.0-or-later

/// The three ActivityWatch event payloads of SEMANTICS.md §10
/// (`activity.schema.json`): `currentwindow`, `afkstatus` and
/// `web.tab.current`. Their required keys never overlap (`app`, `status`,
/// `domain`), which is how a decoder tells them apart. Payloads are flat, so
/// value equality is the deep equality heartbeat merging needs (§10.1).
public enum EventData: Hashable, Sendable, Codable {
    case window(WindowData)
    case afk(AfkStatus)
    case webTab(WebTabData)

    private enum Keys: String, CodingKey, CaseIterable {
        case app, status, domain
    }

    private enum AfkKeys: String, CodingKey, CaseIterable {
        case status
    }

    public init(from decoder: any Decoder) throws {
        let keys = try decoder.container(keyedBy: Keys.self)
        if keys.contains(.app) {
            self = .window(try WindowData(from: decoder))
        } else if keys.contains(.status) {
            let container = try decoder.strictContainer(keyedBy: AfkKeys.self)
            self = .afk(try container.decode(AfkStatus.self, forKey: .status))
        } else if keys.contains(.domain) {
            self = .webTab(try WebTabData(from: decoder))
        } else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unknown event data")
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .window(let window):
            try window.encode(to: encoder)
        case .afk(let status):
            var container = encoder.container(keyedBy: AfkKeys.self)
            try container.encode(status, forKey: .status)
        case .webTab(let tab):
            try tab.encode(to: encoder)
        }
    }
}

/// `windowData`: the foreground app (a bundle id on macOS, a package name on
/// Android) and its window title, kept only when the user turned titles on.
public struct WindowData: Hashable, Sendable, Codable {
    public var app: String
    public var title: String?

    public init(app: String, title: String? = nil) {
        self.app = app
        self.title = title
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case app, title
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        app = try container.decode(String.self, forKey: .app)
        title = try container.decodeIfPresent(String.self, forKey: .title)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(app, forKey: .app)
        try container.encodeIfPresent(title, forKey: .title)
    }
}

/// `webTabData`: the focused tab by normalised domain and path (never a
/// query or fragment), its resolved surface and, when the user opted in, its title.
public struct WebTabData: Hashable, Sendable, Codable {
    public var domain: String
    public var path: String
    public var surface: String?
    public var audible: Bool
    public var incognito: Bool
    public var title: String?

    public init(
        domain: String, path: String, surface: String?, audible: Bool, incognito: Bool, title: String? = nil
    ) {
        self.domain = domain
        self.path = path
        self.surface = surface
        self.audible = audible
        self.incognito = incognito
        self.title = title
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case domain, path, surface, audible, incognito, title
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        domain = try container.decode(String.self, forKey: .domain)
        path = try container.decode(String.self, forKey: .path)
        surface = try container.decodeNullable(String.self, forKey: .surface)
        audible = try container.decode(Bool.self, forKey: .audible)
        incognito = try container.decode(Bool.self, forKey: .incognito)
        title = try container.decodeIfPresent(String.self, forKey: .title)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(domain, forKey: .domain)
        try container.encode(path, forKey: .path)
        try container.encode(surface, forKey: .surface)
        try container.encode(audible, forKey: .audible)
        try container.encode(incognito, forKey: .incognito)
        try container.encodeIfPresent(title, forKey: .title)
    }
}
