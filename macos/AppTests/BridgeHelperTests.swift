// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

/// `monki-bridge` ships inside the app at `Contents/Helpers/monki-bridge`
/// (the `path` of the native messaging manifest). The M1 stub reads framed
/// messages from stdin and answers each with `app.unavailable`. The test
/// speaks the wire format by hand, as the browser does.
@Suite("Bridge helper")
struct BridgeHelperTests {
    private struct Run {
        let status: Int32
        let output: Data
    }

    private static let helper = Bundle.main.bundleURL.appending(path: "Contents/Helpers/monki-bridge")

    private static func run(stdin input: Data) throws -> Run {
        let process = Process()
        process.executableURL = helper
        let stdin = Pipe()
        let stdout = Pipe()
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = FileHandle.nullDevice

        try process.run()
        try stdin.fileHandleForWriting.write(contentsOf: input)
        try stdin.fileHandleForWriting.close()
        let output = try stdout.fileHandleForReading.readToEnd() ?? Data()
        process.waitUntilExit()
        return Run(status: process.terminationStatus, output: output)
    }

    private static let maxPayloadBytes = 1_048_576

    private static func header(_ length: UInt32) -> Data {
        withUnsafeBytes(of: length) { Data($0) }
    }

    private static func frame(_ json: String) -> Data {
        header(UInt32(json.utf8.count)) + Data(json.utf8)
    }

    @Test("the helper is embedded in the app bundle")
    func theHelperIsEmbeddedInTheAppBundle() {
        #expect(FileManager.default.isExecutableFile(atPath: Self.helper.path))
    }

    @Test("a framed message is answered with a framed app-unavailable reply")
    func aFramedMessageIsAnsweredWithAFramedAppUnavailableReply() throws {
        let hello = Self.frame(#"{"v":1,"id":"1","type":"hello","payload":{}}"#)

        let run = try Self.run(stdin: hello)

        #expect(run.status == 0)
        #expect(run.output == Self.frame(#"{"type":"app.unavailable"}"#))
    }

    @Test("every message on the port gets its own reply")
    func everyMessageOnThePortGetsItsOwnReply() throws {
        let message = Self.frame(#"{"type":"browser.focus"}"#)
        let reply = Self.frame(#"{"type":"app.unavailable"}"#)

        let run = try Self.run(stdin: message + message)

        #expect(run.status == 0)
        #expect(run.output == reply + reply)
    }

    @Test("an oversized length is refused without a reply")
    func anOversizedLengthIsRefusedWithoutAReply() throws {
        let run = try Self.run(stdin: Self.header(UInt32(Self.maxPayloadBytes + 1)))

        #expect(run.status != 0)
        #expect(run.output.isEmpty)
    }

    @Test("a payload that is not JSON is refused without a reply")
    func aPayloadThatIsNotJSONIsRefusedWithoutAReply() throws {
        let run = try Self.run(stdin: Self.frame("not json"))

        #expect(run.status != 0)
        #expect(run.output.isEmpty)
    }

    @Test("a truncated payload is refused without a reply")
    func aTruncatedPayloadIsRefusedWithoutAReply() throws {
        let run = try Self.run(stdin: Self.header(10) + Data("{}".utf8))

        #expect(run.status != 0)
        #expect(run.output.isEmpty)
    }
}
