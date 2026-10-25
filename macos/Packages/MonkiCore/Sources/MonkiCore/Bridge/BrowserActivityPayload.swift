// SPDX-License-Identifier: AGPL-3.0-or-later

/// `browser.activity` (`browser-activity.schema.json`): one web tab heartbeat
/// as the extension records it. The path never holds a query or fragment and
/// the title is there only when the user turned titles on.
public struct BrowserActivityPayload: Hashable, Sendable {
    public var timestamp: String
    public var duration: Int
    public var tab: WebTabData

    public init(timestamp: String, duration: Int, tab: WebTabData) {
        self.timestamp = timestamp
        self.duration = duration
        self.tab = tab
    }

    /// The heartbeat as an ActivityWatch event for the app's web bucket.
    public var event: ActivityEvent {
        ActivityEvent(timestamp: timestamp, duration: duration, data: .webTab(tab))
    }

    private static let domain = BridgePattern(
        #"^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$"#)
    private static let path = BridgePattern(#"^/[^?#]*$"#)
    private static let surface = BridgePattern(#"^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$"#)

    init(json: JSONValue) throws(BridgeRejection) {
        let reader = try BridgePayloadReader(json, required: ["timestamp", "duration", "data"])
        timestamp = try reader.string("timestamp", pattern: .utcInstant)
        duration = try reader.integer("duration", in: 0...86_400)
        let data = try BridgePayloadReader(
            reader.value("data"), required: ["domain", "path", "surface", "audible", "incognito"],
            optional: ["title"])
        tab = WebTabData(
            domain: try data.string("domain", maxLength: 253, pattern: Self.domain),
            path: try data.string("path", maxLength: 2048, pattern: Self.path),
            surface: try data.nullableString("surface", maxLength: 64, pattern: Self.surface),
            audible: try data.bool("audible"),
            incognito: try data.bool("incognito"),
            title: try data.optionalString("title", maxLength: 1024)
        )
    }

    var json: JSONValue {
        var data: [String: JSONValue] = [
            "domain": .string(tab.domain),
            "path": .string(tab.path),
            "surface": tab.surface.map(JSONValue.string) ?? .null,
            "audible": .bool(tab.audible),
            "incognito": .bool(tab.incognito),
        ]
        if let title = tab.title {
            data["title"] = .string(title)
        }
        return .object([
            "timestamp": .string(timestamp),
            "duration": .number(Double(duration)),
            "data": .object(data),
        ])
    }
}
