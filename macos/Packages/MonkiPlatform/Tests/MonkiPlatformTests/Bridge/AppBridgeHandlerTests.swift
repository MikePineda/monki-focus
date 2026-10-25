// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing
import os

@Suite("app bridge handler")
struct AppBridgeHandlerTests {
    private final class Sinks: Sendable {
        let activity = OSAllocatedUnfairLock(initialState: [(BrowserActivityPayload, HelloPayload.Browser)]())
        let bypasses = OSAllocatedUnfairLock(initialState: [BypassEventPayload]())
        let focus = OSAllocatedUnfairLock(initialState: [Bool]())
    }

    private let sinks = Sinks()
    private var handler: AppBridgeHandler {
        AppBridgeHandler(
            appVersion: "1.2.3",
            activity: { [sinks] heartbeat, browser in sinks.activity.withLock { $0.append((heartbeat, browser)) } },
            focus: { [sinks] payload in sinks.focus.withLock { $0.append(payload.focused) } },
            bypass: { [sinks] event in sinks.bypasses.withLock { $0.append(event) } }
        )
    }

    private let heartbeat = BrowserActivityPayload(
        timestamp: "2026-10-26T00:00:00Z", duration: 0,
        tab: WebTabData(domain: "example.com", path: "/", surface: nil, audible: false, incognito: false))

    @Test("hello is acknowledged with the mac aggregator and names the browser")
    func helloIsAcknowledgedWithTheMacAggregatorAndNamesTheBrowser() {
        var session = BridgeSession()

        let replies = handler.handle(
            .hello(HelloPayload(extensionVersion: "0.1.0", browser: .brave)), session: &session)

        #expect(replies == [.helloAck(HelloAckPayload(appVersion: "1.2.3"))])
        #expect(session.browser == .brave)
    }

    @Test("browser activity after hello reaches the recorder with its browser")
    func browserActivityAfterHelloReachesTheRecorderWithItsBrowser() {
        var session = BridgeSession(browser: .chrome)

        let replies = handler.handle(.browserActivity(heartbeat), session: &session)

        #expect(replies.isEmpty)
        #expect(sinks.activity.withLock { $0.map(\.1) } == [.chrome])
        #expect(sinks.activity.withLock { $0.map(\.0) } == [heartbeat])
    }

    @Test("browser activity before hello is dropped")
    func browserActivityBeforeHelloIsDropped() {
        var session = BridgeSession()

        _ = handler.handle(.browserActivity(heartbeat), session: &session)

        #expect(sinks.activity.withLock { $0.isEmpty })
    }

    @Test("focus and bypass events go to their sinks and are not answered")
    func focusAndBypassEventsGoToTheirSinksAndAreNotAnswered() {
        var session = BridgeSession(browser: .brave)
        let bypass = BypassEventPayload(dedupeKey: "k1", occurredAt: "2026-10-26T00:00:00Z")

        let replies =
            handler.handle(.browserFocus(BrowserFocusPayload(focused: false)), session: &session)
            + handler.handle(.bypassEvent(bypass), session: &session)

        #expect(replies.isEmpty)
        #expect(sinks.focus.withLock { $0 } == [false])
        #expect(sinks.bypasses.withLock { $0 } == [bypass])
    }
}
