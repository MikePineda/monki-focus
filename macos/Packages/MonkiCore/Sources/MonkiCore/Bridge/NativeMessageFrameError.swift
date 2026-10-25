// SPDX-License-Identifier: AGPL-3.0-or-later

/// Why a native messaging frame was refused.
public enum NativeMessageFrameError: Error, Equatable, Sendable {
    /// Fewer than the 4 header bytes were available.
    case truncatedHeader(byteCount: Int)
    /// The payload (declared or actual) is over `NativeMessageFrame.maxPayloadBytes`.
    case payloadTooLarge(byteCount: Int)
    /// The stream ended before the declared payload length.
    case truncatedPayload(expected: Int, actual: Int)

    /// The stable code of `packages/protocol/fixtures/bridge/frames`.
    public var code: String {
        switch self {
        case .truncatedHeader: "truncated_header"
        case .payloadTooLarge: "payload_too_large"
        case .truncatedPayload: "truncated_payload"
        }
    }
}
