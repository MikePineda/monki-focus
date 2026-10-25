// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// A fully validated native messaging message: the envelope plus the
/// payload schema of its type (`packages/protocol/schema/bridge`). The app
/// decodes what the extension sends with `from: .extensionToApp`, so a
/// message that would change rules or unlock something can never reach it.
public enum BridgeMessage: Hashable, Sendable {
    case hello(HelloPayload)
    case browserFocus(BrowserFocusPayload)
    case browserActivity(BrowserActivityPayload)
    case bypassEvent(BypassEventPayload)
    case helloAck(HelloAckPayload)
    case rulesSnapshot(RulesSnapshotPayload)
    case unlockToken(UnlockTokenPayload)
    case focusSessionState(FocusSessionStatePayload)
    case appUnavailable

    public var type: BridgeMessageType {
        switch self {
        case .hello: .hello
        case .browserFocus: .browserFocus
        case .browserActivity: .browserActivity
        case .bypassEvent: .bypassEvent
        case .helloAck: .helloAck
        case .rulesSnapshot: .rulesSnapshot
        case .unlockToken: .unlockToken
        case .focusSessionState: .focusSessionState
        case .appUnavailable: .appUnavailable
        }
    }

    /// Validates `data` (one serialised message) sent from `direction`.
    public static func decode(_ data: Data, from direction: BridgeDirection) throws(BridgeRejection) -> BridgeMessage {
        try decode(BridgeEnvelope.parse(data, from: direction))
    }

    /// Validates an already parsed message sent from `direction`.
    public static func decode(_ value: JSONValue, from direction: BridgeDirection) throws(BridgeRejection)
        -> BridgeMessage
    {
        try decode(BridgeEnvelope.validate(value, from: direction))
    }

    private static func decode(_ envelope: BridgeEnvelope) throws(BridgeRejection) -> BridgeMessage {
        let payload = JSONValue.object(envelope.payload)
        switch envelope.type {
        case .hello: return .hello(try HelloPayload(json: payload))
        case .browserFocus: return .browserFocus(try BrowserFocusPayload(json: payload))
        case .browserActivity: return .browserActivity(try BrowserActivityPayload(json: payload))
        case .bypassEvent: return .bypassEvent(try BypassEventPayload(json: payload))
        case .helloAck: return .helloAck(try HelloAckPayload(json: payload))
        case .rulesSnapshot: return .rulesSnapshot(try RulesSnapshotPayload(json: payload))
        case .unlockToken: return .unlockToken(try UnlockTokenPayload(json: payload))
        case .focusSessionState: return .focusSessionState(try FocusSessionStatePayload(json: payload))
        case .appUnavailable:
            _ = try BridgePayloadReader(payload, required: [])
            return .appUnavailable
        }
    }

    public var payloadJSON: JSONValue {
        switch self {
        case .hello(let payload): payload.json
        case .browserFocus(let payload): payload.json
        case .browserActivity(let payload): payload.json
        case .bypassEvent(let payload): payload.json
        case .helloAck(let payload): payload.json
        case .rulesSnapshot(let payload): payload.json
        case .unlockToken(let payload): payload.json
        case .focusSessionState(let payload): payload.json
        case .appUnavailable: .object([:])
        }
    }

    /// The message in its envelope.
    public func envelope(id: String) -> BridgeEnvelope {
        guard case .object(let payload) = payloadJSON else {
            return BridgeEnvelope(id: id, type: type, payload: [:])
        }
        return BridgeEnvelope(id: id, type: type, payload: payload)
    }

    /// Compact JSON of the message in its envelope (one NDJSON line, no line feed).
    public func encoded(id: String) -> Data {
        envelope(id: id).encoded()
    }
}
