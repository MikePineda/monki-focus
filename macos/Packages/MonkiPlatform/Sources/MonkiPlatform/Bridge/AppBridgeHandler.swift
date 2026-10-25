// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// The app's side of the conversation:
///
/// - `hello`: remembers the browser for the connection and answers
///   `hello.ack {aggregator: "mac"}`, so the extension stops syncing its own
///   blocks (it keeps its local stats).
/// - `browser.activity`: hands the heartbeat to `activity` with the
///   connection's browser; a heartbeat before `hello` is dropped.
/// - `browser.focus` and `bypass.event`: handed to their sinks (the dedupe
///   and the outbox of later work packages; no-ops until then).
///
/// Nothing it receives can change rules or unlock anything, and it answers
/// only `hello`.
public struct AppBridgeHandler: BridgeMessageHandler {
    public typealias ActivitySink = @Sendable (BrowserActivityPayload, HelloPayload.Browser) -> Void

    private let appVersion: String
    private let activity: ActivitySink
    private let focus: @Sendable (BrowserFocusPayload) -> Void
    private let bypass: @Sendable (BypassEventPayload) -> Void

    public init(
        appVersion: String,
        activity: @escaping ActivitySink,
        focus: @escaping @Sendable (BrowserFocusPayload) -> Void = { _ in },
        bypass: @escaping @Sendable (BypassEventPayload) -> Void = { _ in }
    ) {
        self.appVersion = appVersion
        self.activity = activity
        self.focus = focus
        self.bypass = bypass
    }

    public func handle(_ message: BridgeMessage, session: inout BridgeSession) -> [BridgeMessage] {
        switch message {
        case .hello(let hello):
            session.browser = hello.browser
            return [.helloAck(HelloAckPayload(appVersion: appVersion))]
        case .browserActivity(let heartbeat):
            if let browser = session.browser {
                activity(heartbeat, browser)
            }
            return []
        case .browserFocus(let payload):
            focus(payload)
            return []
        case .bypassEvent(let payload):
            bypass(payload)
            return []
        case .helloAck, .rulesSnapshot, .unlockToken, .focusSessionState, .appUnavailable:
            // Unreachable: the connection decodes only extension-to-app types.
            return []
        }
    }
}
