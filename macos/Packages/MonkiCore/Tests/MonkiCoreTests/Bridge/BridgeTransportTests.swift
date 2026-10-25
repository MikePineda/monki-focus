// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// The pure pieces under the socket: NDJSON lines, the socket path, the
/// native host manifest and the compact JSON writer.
@Suite("Bridge transport")
struct BridgeTransportTests {
    @Test("lines split on line feeds and an unfinished line waits")
    func linesSplitOnLineFeedsAndAnUnfinishedLineWaits() throws {
        var buffer = BridgeLineBuffer()

        let first = try buffer.append(Data("{\"a\":1}\n{\"b\"".utf8))
        let second = try buffer.append(Data(":2}\n".utf8))

        #expect(first == [Data("{\"a\":1}".utf8)])
        #expect(second == [Data("{\"b\":2}".utf8)])
        #expect(buffer.pendingByteCount == 0)
    }

    @Test("a line over the limit fails before it ends")
    func aLineOverTheLimitFailsBeforeItEnds() {
        var buffer = BridgeLineBuffer(maxLineBytes: 8)

        #expect(throws: BridgeLineBuffer.Failure.lineTooLong) {
            try buffer.append(Data("123456789".utf8))
        }
    }

    @Test("a complete line over the limit fails")
    func aCompleteLineOverTheLimitFails() {
        var buffer = BridgeLineBuffer(maxLineBytes: 4)

        #expect(throws: BridgeLineBuffer.Failure.lineTooLong) {
            try buffer.append(Data("12345\n".utf8))
        }
    }

    @Test("the socket lives in the user's application support folder")
    func theSocketLivesInTheUsersApplicationSupportFolder() throws {
        #expect(
            try BridgeSocketPath.path(home: "/Users/someone/")
                == "/Users/someone/Library/Application Support/monki-focus/bridge.sock")
    }

    @Test("a socket path that does not fit sun_path is refused")
    func aSocketPathThatDoesNotFitSunPathIsRefused() {
        let home = "/" + String(repeating: "h", count: 60)

        #expect(throws: BridgeSocketPath.Failure.self) { try BridgeSocketPath.path(home: home) }
        #expect(throws: BridgeSocketPath.Failure.notAbsolute) { try BridgeSocketPath.validated("relative.sock") }
    }

    @Test("the host manifest names the helper and only the listed extensions")
    func theHostManifestNamesTheHelperAndOnlyTheListedExtensions() throws {
        let id = String(repeating: "a", count: 32)
        let other = String(repeating: "p", count: 32)

        let manifest = try NativeHostManifest(
            helperPath: "/Applications/MonkiFocus.app/Contents/Helpers/monki-bridge", extensionIds: [other, id, id])

        #expect(
            try StrictJSONParser.parse(manifest.encoded())
                == .object([
                    "name": .string("dev.monkifocus.bridge"),
                    "description": .string(NativeHostManifest.description),
                    "path": .string("/Applications/MonkiFocus.app/Contents/Helpers/monki-bridge"),
                    "type": .string("stdio"),
                    "allowed_origins": .array([
                        .string("chrome-extension://\(id)/"), .string("chrome-extension://\(other)/"),
                    ]),
                ]))
        #expect(NativeHostManifest.fileName == "dev.monkifocus.bridge.json")
    }

    @Test("a manifest without a valid extension id or with a relative path is refused")
    func aManifestWithoutAValidExtensionIdOrWithARelativePathIsRefused() {
        let id = String(repeating: "b", count: 32)

        #expect(throws: NativeHostManifest.Failure.noExtensionIds) {
            try NativeHostManifest(helperPath: "/a/monki-bridge", extensionIds: [])
        }
        #expect(throws: NativeHostManifest.Failure.invalidExtensionId) {
            try NativeHostManifest(helperPath: "/a/monki-bridge", extensionIds: ["*"])
        }
        #expect(throws: NativeHostManifest.Failure.invalidExtensionId) {
            try NativeHostManifest(helperPath: "/a/monki-bridge", extensionIds: [String(repeating: "q", count: 32)])
        }
        #expect(throws: NativeHostManifest.Failure.helperPathNotAbsolute) {
            try NativeHostManifest(helperPath: "monki-bridge", extensionIds: [id])
        }
    }

    @Test("the writer is compact, sorted and never emits a raw line feed")
    func theWriterIsCompactSortedAndNeverEmitsARawLineFeed() throws {
        let value = JSONValue.object([
            "b": .array([.number(1), .number(1.5), .bool(true), .null]),
            "a": .string("line\nfeed \"quoted\" / é \u{01}"),
        ])

        let text = JSONValueWriter.string(value)

        #expect(text == #"{"a":"line\nfeed \"quoted\" / é \u0001","b":[1,1.5,true,null]}"#)
        #expect(try StrictJSONParser.parse(text) == value)
    }
}
