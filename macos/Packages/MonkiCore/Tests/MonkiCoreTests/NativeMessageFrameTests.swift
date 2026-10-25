// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// Chromium native messaging: every message is a UInt32 length in native
/// byte order followed by that many bytes of UTF-8 JSON.
@Suite("Native message frame")
struct NativeMessageFrameTests {
    private func nativeHeader(_ length: UInt32) -> Data {
        withUnsafeBytes(of: length) { Data($0) }
    }

    @Test("a frame prefixes the payload with its native-endian 4-byte length")
    func aFramePrefixesThePayloadWithItsNativeEndianLength() throws {
        let payload = Data(#"{"type":"hello"}"#.utf8)

        let frame = try NativeMessageFrame.encode(payload)

        #expect(frame.count == 4 + payload.count)
        #expect(frame.prefix(4) == nativeHeader(UInt32(payload.count)))
        #expect(frame.dropFirst(4) == payload)
    }

    @Test("a header decodes to the payload length")
    func aHeaderDecodesToThePayloadLength() throws {
        #expect(try NativeMessageFrame.payloadLength(header: nativeHeader(27)) == 27)
        #expect(try NativeMessageFrame.payloadLength(header: nativeHeader(0)) == 0)
    }

    @Test("a header shorter than 4 bytes is rejected")
    func aHeaderShorterThanFourBytesIsRejected() {
        #expect(throws: NativeMessageFrameError.truncatedHeader(byteCount: 3)) {
            try NativeMessageFrame.payloadLength(header: Data([1, 0, 0]))
        }
    }

    @Test("a declared length over 1 MiB is rejected before reading the payload")
    func aDeclaredLengthOverOneMebibyteIsRejected() {
        let tooLong = UInt32(NativeMessageFrame.maxPayloadBytes + 1)

        #expect(throws: NativeMessageFrameError.payloadTooLarge(byteCount: Int(tooLong))) {
            try NativeMessageFrame.payloadLength(header: nativeHeader(tooLong))
        }
    }

    @Test("a payload over 1 MiB is never encoded")
    func aPayloadOverOneMebibyteIsNeverEncoded() {
        let payload = Data(count: NativeMessageFrame.maxPayloadBytes + 1)

        #expect(throws: NativeMessageFrameError.payloadTooLarge(byteCount: payload.count)) {
            try NativeMessageFrame.encode(payload)
        }
    }

    @Test("a payload of exactly 1 MiB is accepted")
    func aPayloadOfExactlyOneMebibyteIsAccepted() throws {
        let payload = Data(count: NativeMessageFrame.maxPayloadBytes)

        #expect(try NativeMessageFrame.encode(payload).count == payload.count + 4)
    }

    @Test("the app-unavailable reply is a full envelope")
    func theAppUnavailableReplyIsAFullEnvelope() throws {
        let reply = try StrictJSONParser.parse(BridgeReply.appUnavailable)

        #expect(
            reply
                == .object([
                    "v": .number(1), "id": .string("app-unavailable"), "type": .string("app.unavailable"),
                    "payload": .object([:]),
                ]))
    }
}
