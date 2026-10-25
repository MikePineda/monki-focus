// SPDX-License-Identifier: AGPL-3.0-or-later

/// What browser dedupe needs on the macOS aggregator
/// (`activity-fixture.schema.json` `BrowserDedupeGiven`, SEMANTICS.md §10.8).
public struct BrowserDedupeInput: Hashable, Sendable, Codable {
    /// Bundle ids whose window time the extension can explain.
    public var browserApps: [String]
    /// How long after a heartbeat the extension still counts as live.
    public var staleAfterSeconds: Int
    public var windowEvents: [ActivityEvent]
    public var webEvents: [ActivityEvent]
    /// The extension's latest heartbeat, or nil when it never sent one.
    public var extensionLastHeartbeatAt: String?

    public init(
        browserApps: [String],
        staleAfterSeconds: Int,
        windowEvents: [ActivityEvent],
        webEvents: [ActivityEvent],
        extensionLastHeartbeatAt: String?
    ) {
        self.browserApps = browserApps
        self.staleAfterSeconds = staleAfterSeconds
        self.windowEvents = windowEvents
        self.webEvents = webEvents
        self.extensionLastHeartbeatAt = extensionLastHeartbeatAt
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case browserApps, staleAfterSeconds, windowEvents, webEvents, extensionLastHeartbeatAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        browserApps = try container.decode([String].self, forKey: .browserApps)
        staleAfterSeconds = try container.decode(Int.self, forKey: .staleAfterSeconds)
        windowEvents = try container.decode([ActivityEvent].self, forKey: .windowEvents)
        webEvents = try container.decode([ActivityEvent].self, forKey: .webEvents)
        extensionLastHeartbeatAt = try container.decodeNullable(String.self, forKey: .extensionLastHeartbeatAt)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(browserApps, forKey: .browserApps)
        try container.encode(staleAfterSeconds, forKey: .staleAfterSeconds)
        try container.encode(windowEvents, forKey: .windowEvents)
        try container.encode(webEvents, forKey: .webEvents)
        try container.encode(extensionLastHeartbeatAt, forKey: .extensionLastHeartbeatAt)
    }
}
