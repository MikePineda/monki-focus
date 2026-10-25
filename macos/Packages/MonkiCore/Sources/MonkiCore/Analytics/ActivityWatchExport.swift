// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// ActivityWatch export, in the shape aw-server writes for `GET /api/0/export`
/// and reads back on `POST /api/0/import`: `{"buckets": {"<id>": {id, created,
/// type, client, hostname, data, events: [{timestamp, duration, data}]}}}`.
/// Durations are seconds, timestamps RFC 3339 UTC. Event data follows the
/// standard bucket types: `currentwindow` `{app, title}`, `afkstatus`
/// `{status}` and `web.tab.current` `{url, title, audible, incognito}`; web
/// events also keep `domain`, `path` and `surface`, and their `url` is
/// rebuilt from them (never a query or fragment, which are not stored).
/// This is the user's own data leaving through the user's own action.
/// Decoding ignores keys it does not know, as aw-server's own exports carry more.
public struct ActivityWatchExport: Hashable, Sendable, Codable {
    /// A flat event data value: a string, a boolean or null.
    public enum Value: Hashable, Sendable, Codable {
        case string(String)
        case bool(Bool)
        case null

        public init(from decoder: any Decoder) throws {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() {
                self = .null
            } else if let flag = try? container.decode(Bool.self) {
                self = .bool(flag)
            } else {
                self = .string(try container.decode(String.self))
            }
        }

        public func encode(to encoder: any Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case .string(let text): try container.encode(text)
            case .bool(let flag): try container.encode(flag)
            case .null: try container.encodeNil()
            }
        }
    }

    public struct Event: Hashable, Sendable, Codable {
        public var timestamp: String
        /// Seconds; aw-server writes fractions, an export writes whole seconds.
        public var duration: Double
        public var data: [String: Value]

        public init(timestamp: String, duration: Double, data: [String: Value]) {
            self.timestamp = timestamp
            self.duration = duration
            self.data = data
        }
    }

    public struct Bucket: Hashable, Sendable, Codable {
        public var id: String
        public var created: String
        public var type: ActivityWatchBucketType
        public var client: String
        public var hostname: String
        /// Always `{}` on export.
        public var data: [String: Value]
        public var events: [Event]

        public init(
            id: String,
            created: String,
            type: ActivityWatchBucketType,
            client: String,
            hostname: String,
            data: [String: Value],
            events: [Event]
        ) {
            self.id = id
            self.created = created
            self.type = type
            self.client = client
            self.hostname = hostname
            self.data = data
            self.events = events
        }
    }

    public var buckets: [String: Bucket]

    public init(buckets: [String: Bucket]) {
        self.buckets = buckets
    }
}

private func exportedData(_ type: ActivityWatchBucketType, _ data: EventData) throws(AnalyticsError)
    -> [String: ActivityWatchExport.Value]
{
    switch (type, data) {
    case (.currentWindow, .window(let window)):
        return ["app": .string(window.app), "title": .string(window.title ?? "")]
    case (.afkStatus, .afk(let status)):
        return ["status": .string(status.rawValue)]
    case (.webTabCurrent, .webTab(let tab)):
        return [
            "url": .string("https://\(tab.domain)\(tab.path)"),
            "title": .string(tab.title ?? ""),
            "audible": .bool(tab.audible),
            "incognito": .bool(tab.incognito),
            "domain": .string(tab.domain),
            "path": .string(tab.path),
            "surface": tab.surface.map { .string($0) } ?? .null,
        ]
    default:
        throw .eventDoesNotFitBucket(type)
    }
}

/// The export document of local buckets; events in timestamp order (stable).
public func toActivityWatchExport(_ buckets: [ActivityWatchBucket]) throws -> ActivityWatchExport {
    var exported: [String: ActivityWatchExport.Bucket] = [:]
    for bucket in buckets {
        guard exported[bucket.id] == nil else { throw AnalyticsError.duplicateBucketId(bucket.id) }
        var timed: [(start: Int, event: ActivityEvent)] = []
        for event in bucket.events { timed.append((try epochSecondsOf(event.timestamp), event)) }
        let events = try timed.enumerated()
            .sorted {
                $0.element.start != $1.element.start ? $0.element.start < $1.element.start : $0.offset < $1.offset
            }
            .map {
                ActivityWatchExport.Event(
                    timestamp: utcInstantOf($0.element.start),
                    duration: Double($0.element.event.duration),
                    data: try exportedData(bucket.type, $0.element.event.data)
                )
            }
        exported[bucket.id] = ActivityWatchExport.Bucket(
            id: bucket.id,
            created: utcInstantOf(try epochSecondsOf(bucket.created)),
            type: bucket.type,
            client: bucket.client,
            hostname: bucket.hostname,
            data: [:],
            events: events
        )
    }
    return ActivityWatchExport(buckets: exported)
}

private func text(_ data: [String: ActivityWatchExport.Value], _ key: String) throws(AnalyticsError) -> String {
    guard case .string(let value)? = data[key] else { throw .invalidEventData(key) }
    return value
}

private func flag(_ data: [String: ActivityWatchExport.Value], _ key: String) throws(AnalyticsError) -> Bool {
    guard case .bool(let value)? = data[key] else { throw .invalidEventData(key) }
    return value
}

private func importedData(_ type: ActivityWatchBucketType, _ data: [String: ActivityWatchExport.Value])
    throws(AnalyticsError) -> EventData
{
    var title: String?
    if case .string(let value)? = data["title"], !value.isEmpty { title = value }
    switch type {
    case .currentWindow:
        return .window(WindowData(app: try text(data, "app"), title: title))
    case .afkStatus:
        guard let status = AfkStatus(rawValue: try text(data, "status")) else { throw .invalidEventData("status") }
        return .afk(status)
    case .webTabCurrent:
        let surface: String? = data["surface"] == .null ? nil : try text(data, "surface")
        return .webTab(
            WebTabData(
                domain: try text(data, "domain"),
                path: try text(data, "path"),
                surface: surface,
                audible: try flag(data, "audible"),
                incognito: try flag(data, "incognito"),
                title: title
            )
        )
    }
}

/// aw-server writes microseconds (`…:00.123456+00:00`); instants here are whole seconds.
private func wholeSecondsOf(_ timestamp: String) throws(EngineError) -> String {
    let whole = timestamp.replacingOccurrences(
        of: #"\.[0-9]+(?=Z$|[+-][0-9]{2}:[0-9]{2}$)"#,
        with: "",
        options: .regularExpression
    )
    return utcInstantOf(try epochSecondsOf(whole))
}

/// Reads back an export written by `toActivityWatchExport` (after a JSON
/// round trip) or by aw-server: timestamps in UTC `Z` (fractions dropped),
/// durations rounded to whole seconds (half up). Buckets come in id order
/// (code units), since a JSON object has none.
public func fromActivityWatchExport(_ document: ActivityWatchExport) throws -> [ActivityWatchBucket] {
    try document.buckets.values.sorted { CodeUnitOrder.less($0.id, $1.id) }
        .map { bucket in
            ActivityWatchBucket(
                id: bucket.id,
                type: bucket.type,
                client: bucket.client,
                hostname: bucket.hostname,
                created: try wholeSecondsOf(bucket.created),
                events: try bucket.events.map { event in
                    ActivityEvent(
                        timestamp: try wholeSecondsOf(event.timestamp),
                        duration: Int((event.duration + 0.5).rounded(.down)),
                        data: try importedData(bucket.type, event.data)
                    )
                }
            )
        }
}
