// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Chromium native messaging framing: a 4-byte unsigned length in native
/// byte order, then that many bytes of UTF-8 JSON. Used by `monki-bridge`
/// on stdin and stdout. Both directions are capped at 1 MiB (the browser's
/// limit for host-to-extension messages), and an oversized length is refused
/// from the header alone so the payload is never buffered.
public enum NativeMessageFrame {
    /// Size of the length prefix.
    public static let headerByteCount = 4
    /// Largest accepted payload, in bytes.
    public static let maxPayloadBytes = 1_048_576

    /// Prefixes `payload` with its length.
    public static func encode(_ payload: Data) throws(NativeMessageFrameError) -> Data {
        guard payload.count <= maxPayloadBytes else {
            throw .payloadTooLarge(byteCount: payload.count)
        }
        var frame = withUnsafeBytes(of: UInt32(payload.count)) { Data($0) }
        frame.append(payload)
        return frame
    }

    /// Reads the payload length from the first 4 bytes of `header`.
    public static func payloadLength(header: Data) throws(NativeMessageFrameError) -> Int {
        guard header.count >= headerByteCount else {
            throw .truncatedHeader(byteCount: header.count)
        }
        let length = header.prefix(headerByteCount).withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }
        guard length <= maxPayloadBytes else {
            throw .payloadTooLarge(byteCount: Int(length))
        }
        return Int(length)
    }
}
