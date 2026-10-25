// SPDX-License-Identifier: AGPL-3.0-or-later

/// Why a native messaging message was refused, in the order the checks run
/// (`packages/protocol/fixtures/bridge/README.md`). The codes are shared with
/// the extension and the fixtures; they never carry message content.
public enum BridgeRejection: Error, Hashable, Sendable, CaseIterable {
    /// The serialised message is over `BridgeContract.maxMessageBytes`.
    case tooLarge
    /// Not strict JSON (syntax, duplicate keys, too deep).
    case invalidJSON
    /// Not an object with exactly `v`, `id`, `type`, `payload`; a bad `id`; a non-string `type`.
    case invalidEnvelope
    /// `v` is not 1.
    case unsupportedVersion
    /// `type` is not a known message type.
    case unknownType
    /// A known type the sender is not allowed to send.
    case wrongDirection
    /// `payload` is not a JSON object.
    case payloadNotObject
    /// `payload` does not match the type's schema.
    case invalidPayload

    /// The stable snake_case code (`too_large`, `invalid_payload`, ...).
    public var code: String {
        switch self {
        case .tooLarge: "too_large"
        case .invalidJSON: "invalid_json"
        case .invalidEnvelope: "invalid_envelope"
        case .unsupportedVersion: "unsupported_version"
        case .unknownType: "unknown_type"
        case .wrongDirection: "wrong_direction"
        case .payloadNotObject: "payload_not_object"
        case .invalidPayload: "invalid_payload"
        }
    }
}
