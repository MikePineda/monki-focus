// SPDX-License-Identifier: AGPL-3.0-or-later

/// The message types of the native messaging contract
/// (`packages/protocol/schema/bridge`), with their wire names.
public enum BridgeMessageType: String, Hashable, Sendable, CaseIterable {
    case hello = "hello"
    case browserFocus = "browser.focus"
    case browserActivity = "browser.activity"
    case bypassEvent = "bypass.event"
    case helloAck = "hello.ack"
    case rulesSnapshot = "rules.snapshot"
    case unlockToken = "unlock.token"
    case focusSessionState = "focusSession.state"
    case appUnavailable = "app.unavailable"

    /// The only side allowed to send this type. Nothing the extension may
    /// send changes rules or grants an unlock.
    public var direction: BridgeDirection {
        switch self {
        case .hello, .browserFocus, .browserActivity, .bypassEvent: .extensionToApp
        case .helloAck, .rulesSnapshot, .unlockToken, .focusSessionState, .appUnavailable: .appToExtension
        }
    }
}
