// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

@Suite("ActivityWatch export")
struct ActivityWatchExportTests {
    private static let host = "test-host"

    private static func window(_ timestamp: String, _ duration: Int, title: String? = nil) -> ActivityEvent {
        ActivityEvent(
            timestamp: timestamp, duration: duration, data: .window(WindowData(app: "org.example.Editor", title: title))
        )
    }

    private static let windowBucket = ActivityWatchBucket(
        id: activityWatchBucketId(.currentWindow, hostname: host),
        type: .currentWindow,
        client: "monki-focus-mac",
        hostname: host,
        created: "2026-10-26T08:00:00Z",
        events: [window("2026-10-26T09:05:00Z", 120, title: "Draft"), window("2026-10-26T09:00:00Z", 300)]
    )

    private static let afkBucket = ActivityWatchBucket(
        id: activityWatchBucketId(.afkStatus, hostname: host),
        type: .afkStatus,
        client: "monki-focus-mac",
        hostname: host,
        created: "2026-10-26T08:00:00Z",
        events: [ActivityEvent(timestamp: "2026-10-26T09:00:00Z", duration: 420, data: .afk(.notAfk))]
    )

    private static let webBucket = ActivityWatchBucket(
        id: activityWatchBucketId(.webTabCurrent, hostname: host),
        type: .webTabCurrent,
        client: "monki-focus-web",
        hostname: host,
        created: "2026-10-26T08:00:00Z",
        events: [
            ActivityEvent(
                timestamp: "2026-10-26T09:00:00Z",
                duration: 60,
                data: .webTab(
                    WebTabData(
                        domain: "example.org", path: "/docs", surface: "example.docs", audible: false,
                        incognito: false, title: "Docs"))
            ),
            ActivityEvent(
                timestamp: "2026-10-26T09:01:00Z",
                duration: 30,
                data: .webTab(
                    WebTabData(domain: "example.org", path: "/", surface: nil, audible: false, incognito: true))
            ),
        ]
    )

    @Test("aw export roundtrips events")
    func awExportRoundtripsEvents() throws {
        let buckets = [Self.windowBucket, Self.afkBucket, Self.webBucket]

        let json = try JSONEncoder().encode(try toActivityWatchExport(buckets))
        let read = try fromActivityWatchExport(JSONDecoder().decode(ActivityWatchExport.self, from: json))

        let expected = buckets.map { bucket in
            var sorted = bucket
            sorted.events.sort { $0.timestamp < $1.timestamp }
            return sorted
        }
        #expect(read == expected.sorted { $0.id < $1.id })
    }

    @Test("aw export has the aw-server shape")
    func awExportHasTheAwServerShape() throws {
        let exported = try toActivityWatchExport([Self.windowBucket, Self.afkBucket, Self.webBucket])
        let json = try StrictJSONParser.parse(JSONEncoder().encode(exported))

        let expectedWindow = try StrictJSONParser.parse(
            """
            {"id": "monki-window_test-host", "created": "2026-10-26T08:00:00Z", "type": "currentwindow",
             "client": "monki-focus-mac", "hostname": "test-host", "data": {},
             "events": [
               {"timestamp": "2026-10-26T09:00:00Z", "duration": 300, "data": {"app": "org.example.Editor", "title": ""}},
               {"timestamp": "2026-10-26T09:05:00Z", "duration": 120, "data": {"app": "org.example.Editor", "title": "Draft"}}
             ]}
            """)
        #expect(
            Set(exported.buckets.keys) == [
                "monki-window_test-host", "monki-afk_test-host", "monki-web-chrome_test-host",
            ])
        #expect(json.value(at: "/buckets/monki-window_test-host") == expectedWindow)
        #expect(
            json.value(at: "/buckets/monki-web-chrome_test-host/events/0/data")
                == (try StrictJSONParser.parse(
                    """
                    {"url": "https://example.org/docs", "title": "Docs", "audible": false, "incognito": false,
                     "domain": "example.org", "path": "/docs", "surface": "example.docs"}
                    """)))
    }

    @Test("the web bucket id names the browser for the aw dashboard")
    func theWebBucketIdNamesTheBrowserForTheAwDashboard() {
        #expect(
            activityWatchBucketId(.webTabCurrent, hostname: Self.host, browser: "brave") == "monki-web-brave_test-host")
    }

    @Test("duplicate bucket ids are rejected")
    func duplicateBucketIdsAreRejected() {
        #expect(throws: AnalyticsError.duplicateBucketId(Self.afkBucket.id)) {
            try toActivityWatchExport([Self.afkBucket, Self.afkBucket])
        }
    }

    @Test(
        "an event that does not fit its bucket is rejected",
        arguments: [
            (ActivityWatchBucketType.currentWindow, EventData.afk(.afk)),
            (
                .afkStatus,
                .webTab(WebTabData(domain: "example.org", path: "/", surface: nil, audible: false, incognito: false))
            ),
            (.webTabCurrent, .window(WindowData(app: "org.example.Editor"))),
        ])
    func anEventThatDoesNotFitItsBucketIsRejected(type: ActivityWatchBucketType, data: EventData) {
        var bucket = Self.windowBucket
        bucket.type = type
        bucket.events = [ActivityEvent(timestamp: "2026-10-26T09:00:00Z", duration: 1, data: data)]

        #expect(throws: AnalyticsError.eventDoesNotFitBucket(type)) { try toActivityWatchExport([bucket]) }
    }

    @Test("aw-style offsets and fractional durations are read as utc whole seconds")
    func awStyleOffsetsAndFractionalDurationsAreReadAsUtcWholeSeconds() throws {
        let document = try JSONDecoder().decode(
            ActivityWatchExport.self,
            from: Data(
                """
                {"buckets": {"afk": {"id": "afk", "created": "2026-10-26T08:00:00.123456+00:00", "type": "afkstatus",
                 "client": "aw-watcher-afk", "hostname": "test-host", "data": {}, "name": null,
                 "events": [{"timestamp": "2026-10-26T19:00:00+10:00", "duration": 59.6, "data": {"status": "afk"}}]}}}
                """.utf8))

        let bucket = try #require(try fromActivityWatchExport(document).first)

        #expect(bucket.created == "2026-10-26T08:00:00Z")
        #expect(bucket.events == [ActivityEvent(timestamp: "2026-10-26T09:00:00Z", duration: 60, data: .afk(.afk))])
    }

    @Test(
        "a malformed event is rejected",
        arguments: [
            (ActivityWatchBucketType.afkStatus, ["status": ActivityWatchExport.Value.string("away")], "status"),
            (.afkStatus, ["status": .bool(true)], "status"),
            (.currentWindow, ["title": .string("x")], "app"),
            (
                .webTabCurrent,
                ["domain": .string("example.org"), "path": .string("/"), "surface": .null, "audible": .string("no")],
                "audible"
            ),
            (
                .webTabCurrent, ["domain": .string("example.org"), "path": .string("/"), "surface": .bool(true)],
                "surface"
            ),
            (.webTabCurrent, ["domain": .string("example.org"), "path": .string("/")], "surface"),
        ])
    func aMalformedEventIsRejected(
        type: ActivityWatchBucketType, data: [String: ActivityWatchExport.Value], key: String
    ) {
        let document = ActivityWatchExport(buckets: [
            "bucket": ActivityWatchExport.Bucket(
                id: "bucket", created: "2026-10-26T08:00:00Z", type: type, client: "monki-focus-web",
                hostname: Self.host, data: [:],
                events: [ActivityWatchExport.Event(timestamp: "2026-10-26T09:00:00Z", duration: 1, data: data)])
        ])

        #expect(throws: AnalyticsError.invalidEventData(key)) { try fromActivityWatchExport(document) }
    }
}
