// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing

/// The extension's web heartbeats feed a per-browser bucket through the
/// capture's heartbeat queue.
@MainActor
@Suite("browser activity recorder")
struct BrowserActivityRecorderTests {
    private let time = FakeTime()
    private let store: RecordingEventStore
    private let queue: HeartbeatQueue
    private let recorder: BrowserActivityRecorder

    init() throws {
        store = try RecordingEventStore()
        queue = HeartbeatQueue(store: store)
        recorder = BrowserActivityRecorder(queue: queue, hostname: "test-host", deviceId: "device-a", wall: time.wall)
    }

    private func heartbeat(_ offset: Int, domain: String = "example.com") -> BrowserActivityPayload {
        BrowserActivityPayload(
            timestamp: utcInstantOf(FakeTime.origin + offset), duration: 0,
            tab: WebTabData(domain: domain, path: "/", surface: nil, audible: false, incognito: false))
    }

    @Test("heartbeats within 45 seconds merge into the browser's web bucket")
    func heartbeatsWithin45SecondsMergeIntoTheBrowsersWebBucket() throws {
        #expect(recorder.record(heartbeat(-60), from: .brave))
        #expect(recorder.record(heartbeat(-30), from: .brave))
        #expect(recorder.record(heartbeat(0), from: .brave))
        queue.flush()

        let events = try store.events("monki-web-brave_test-host")
        #expect(events.map(\.duration) == [60])
        #expect(events.first?.data == heartbeat(0).event.data)
    }

    @Test("a gap over the pulsetime opens a new event")
    func aGapOverThePulsetimeOpensANewEvent() throws {
        recorder.record(heartbeat(-120), from: .chrome)
        recorder.record(heartbeat(-60), from: .chrome)
        queue.flush()

        #expect(try store.events("monki-web-chrome_test-host").count == 2)
    }

    @Test("each browser has its own bucket")
    func eachBrowserHasItsOwnBucket() throws {
        recorder.record(heartbeat(0), from: .brave)
        recorder.record(heartbeat(0, domain: "example.org"), from: .chrome)
        queue.flush()

        #expect(try store.events("monki-web-brave_test-host").count == 1)
        #expect(try store.events("monki-web-chrome_test-host").count == 1)
        #expect(recorder.bucket(for: .brave).type == .webTabCurrent)
        #expect(recorder.bucket(for: .brave).client == "monki-focus-web")
    }

    @Test("a heartbeat far from the app's clock is dropped")
    func aHeartbeatFarFromTheAppsClockIsDropped() throws {
        #expect(!recorder.record(heartbeat(-3600), from: .brave))
        #expect(!recorder.record(heartbeat(3600), from: .brave))
        queue.flush()

        #expect(!queue.isRegistered("monki-web-brave_test-host"))
    }
}
