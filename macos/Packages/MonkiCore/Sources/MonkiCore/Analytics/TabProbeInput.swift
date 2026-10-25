// SPDX-License-Identifier: AGPL-3.0-or-later

/// What a browser adapter read when it sampled the focused tab
/// (`activity-fixture.schema.json` `TabProbeGiven`, SEMANTICS.md §10.2).
public struct TabProbeInput: Hashable, Sendable, Codable {
    /// The system idle state the browser reports.
    public enum IdleState: String, Hashable, Sendable, Codable, CaseIterable {
        case active, idle, locked
    }

    /// The active tab of the focused window, with its raw URL text.
    public struct Tab: Hashable, Sendable, Codable {
        public var url: String
        public var audible: Bool
        public var incognito: Bool
        public var title: String?

        public init(url: String, audible: Bool, incognito: Bool, title: String? = nil) {
            self.url = url
            self.audible = audible
            self.incognito = incognito
            self.title = title
        }

        private enum CodingKeys: String, CodingKey, CaseIterable {
            case url, audible, incognito, title
        }

        public init(from decoder: any Decoder) throws {
            let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
            url = try container.decode(String.self, forKey: .url)
            audible = try container.decode(Bool.self, forKey: .audible)
            incognito = try container.decode(Bool.self, forKey: .incognito)
            title = try container.decodeIfPresent(String.self, forKey: .title)
        }
    }

    /// The user's tracking settings.
    public struct Settings: Hashable, Sendable, Codable {
        public var countAudibleWhileIdle: Bool
        public var storeTitles: Bool

        public init(countAudibleWhileIdle: Bool, storeTitles: Bool) {
            self.countAudibleWhileIdle = countAudibleWhileIdle
            self.storeTitles = storeTitles
        }

        private enum CodingKeys: String, CodingKey, CaseIterable {
            case countAudibleWhileIdle, storeTitles
        }

        public init(from decoder: any Decoder) throws {
            let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
            countAudibleWhileIdle = try container.decode(Bool.self, forKey: .countAudibleWhileIdle)
            storeTitles = try container.decode(Bool.self, forKey: .storeTitles)
        }
    }

    public var now: String
    public var windowFocused: Bool
    public var idleState: IdleState
    public var tab: Tab?
    public var settings: Settings

    public init(now: String, windowFocused: Bool, idleState: IdleState, tab: Tab?, settings: Settings) {
        self.now = now
        self.windowFocused = windowFocused
        self.idleState = idleState
        self.tab = tab
        self.settings = settings
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case now, windowFocused, idleState, tab, settings
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        now = try container.decode(String.self, forKey: .now)
        windowFocused = try container.decode(Bool.self, forKey: .windowFocused)
        idleState = try container.decode(IdleState.self, forKey: .idleState)
        tab = try container.decodeNullable(Tab.self, forKey: .tab)
        settings = try container.decode(Settings.self, forKey: .settings)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(now, forKey: .now)
        try container.encode(windowFocused, forKey: .windowFocused)
        try container.encode(idleState, forKey: .idleState)
        try container.encode(tab, forKey: .tab)
        try container.encode(settings, forKey: .settings)
    }
}
