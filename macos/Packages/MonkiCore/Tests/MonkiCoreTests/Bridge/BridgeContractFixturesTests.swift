// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// The native messaging contract, over the same fixtures the extension and
/// the protocol package run (`packages/protocol/fixtures/bridge`).
@Suite("Bridge contract fixtures")
struct BridgeContractFixturesTests {
    @Test("a valid fixture decodes and encodes back to itself", arguments: try BridgeFixture.all("valid"))
    func aValidFixtureDecodesAndEncodesBackToItself(_ fixture: BridgeFixture) throws {
        let message = try BridgeMessage.decode(fixture.bytes, from: fixture.direction)

        let id = try #require(fixture.json.value(at: "/message/id")?.stringValue)
        #expect(message.type.rawValue == fixture.json.value(at: "/message/type")?.stringValue)
        #expect(try StrictJSONParser.parse(message.encoded(id: id)) == fixture.json["message"])
    }

    @Test("an invalid fixture is rejected with its reason", arguments: try BridgeFixture.all("invalid"))
    func anInvalidFixtureIsRejectedWithItsReason(_ fixture: BridgeFixture) throws {
        let reason = try fixture.string("reason")

        let rejection = #expect(throws: BridgeRejection.self) {
            try BridgeMessage.decode(fixture.bytes, from: fixture.direction)
        }

        #expect(rejection?.code == reason)
    }

    @Test("a frame fixture decodes or fails with its code", arguments: try BridgeFixture.all("frames"))
    func aFrameFixtureDecodesOrFailsWithItsCode(_ fixture: BridgeFixture) throws {
        let bytes = Data(hex: try fixture.string("bytesHex"))

        if let error = fixture.json["error"]?.stringValue {
            let thrown = #expect(throws: NativeMessageFrameError.self) {
                try NativeMessageFrame.decodeFirst(bytes)
            }
            #expect(thrown?.code == error)
        } else if fixture.json["endOfStream"] == .bool(true) {
            #expect(try NativeMessageFrame.decodeFirst(bytes) == nil)
        } else {
            let frame = try #require(try NativeMessageFrame.decodeFirst(bytes))
            #expect(frame.payload == Data(try fixture.string("payload").utf8))
            #expect(frame.byteCount == bytes.count)
        }
    }

    @Test("every message type and every rejection code has a fixture")
    func everyMessageTypeAndEveryRejectionCodeHasAFixture() throws {
        let types = try BridgeFixture.all("valid").compactMap { $0.json.value(at: "/message/type")?.stringValue }
        let reasons = try BridgeFixture.all("invalid").map { try $0.string("reason") }

        #expect(Set(types) == Set(BridgeMessageType.allCases.map(\.rawValue)))
        #expect(Set(reasons) == Set(BridgeRejection.allCases.map(\.code)))
    }

    @Test("the envelope check alone never reads the payload")
    func theEnvelopeCheckAloneNeverReadsThePayload() throws {
        // monki-bridge relays on the envelope; the payload schema is the app's job.
        let text = #"{"v":1,"id":"a","type":"browser.focus","payload":{"focused":"not a flag"}}"#

        let envelope = try BridgeEnvelope.parse(Data(text.utf8), from: .extensionToApp)

        #expect(envelope.type == .browserFocus)
        #expect(throws: BridgeRejection.invalidPayload) {
            try BridgeMessage.decode(Data(text.utf8), from: .extensionToApp)
        }
    }

    @Test("nothing the extension may send changes rules or unlocks")
    func nothingTheExtensionMaySendChangesRulesOrUnlocks() {
        let fromExtension = BridgeMessageType.allCases.filter { $0.direction == .extensionToApp }

        #expect(Set(fromExtension) == [.hello, .browserFocus, .browserActivity, .bypassEvent])
    }

    @Test("the app-unavailable reply is a valid message from the app side")
    func theAppUnavailableReplyIsAValidMessageFromTheAppSide() throws {
        #expect(try BridgeMessage.decode(BridgeReply.appUnavailable, from: .appToExtension) == .appUnavailable)
        #expect(!BridgeReply.appUnavailable.contains(UInt8(ascii: "\n")))
    }
}
