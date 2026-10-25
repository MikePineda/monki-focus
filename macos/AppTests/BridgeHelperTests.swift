// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

/// End to end through the built `monki-bridge` (`Contents/Helpers/monki-bridge`,
/// the `path` of the native messaging manifest): framed stdin, as the
/// browser writes it, through the helper to a fake app on a Unix socket, and
/// the app's NDJSON replies back framed on stdout. The test speaks both wire
/// formats by hand. No GUI and no running app are needed: the Debug helper
/// takes its socket from `MONKI_BRIDGE_SOCKET_PATH`.
@Suite("Bridge helper", .serialized)
struct BridgeHelperTests {
    private static let helper = Bundle.main.bundleURL.appending(path: "Contents/Helpers/monki-bridge")
    private static let maxPayloadBytes = 1_048_576

    private static let hello =
        #"{"v":1,"id":"h1","type":"hello","payload":{"extensionVersion":"0.1.0","schemaVersion":1,"browser":"brave"}}"#
    private static let ack =
        #"{"v":1,"id":"a1","type":"hello.ack","payload":{"aggregator":"mac","appVersion":"0.1.0","schemaVersion":1}}"#

    /// A running helper with its pipes.
    private final class Helper {
        let process = Process()
        private let stdin = Pipe()
        private let stdout = Pipe()

        init(socketPath: String) throws {
            // The helper may exit before it reads all of stdin; a late write
            // must fail with EPIPE, not kill the test host.
            signal(SIGPIPE, SIG_IGN)
            process.executableURL = BridgeHelperTests.helper
            process.arguments = ["chrome-extension://abcdefghijklmnopabcdefghijklmnop/"]
            process.environment = ["MONKI_BRIDGE_SOCKET_PATH": socketPath]
            process.standardInput = stdin
            process.standardOutput = stdout
            process.standardError = FileHandle.nullDevice
            try process.run()
            // A watchdog: a stuck helper fails the test instead of hanging it.
            let process = process
            DispatchQueue.global().asyncAfter(deadline: .now() + 15) {
                if process.isRunning { process.terminate() }
            }
        }

        func write(_ bytes: Data) {
            try? stdin.fileHandleForWriting.write(contentsOf: bytes)
        }

        func closeInput() {
            try? stdin.fileHandleForWriting.close()
        }

        /// One framed message from stdout (nil at end of output).
        func readFrame() -> Data? {
            let header = stdout.fileHandleForReading.readData(ofLength: 4)
            guard header.count == 4 else { return nil }
            let length = header.withUnsafeBytes { Int($0.loadUnaligned(as: UInt32.self)) }
            return stdout.fileHandleForReading.readData(ofLength: length)
        }

        func remainingOutput() -> Data {
            (try? stdout.fileHandleForReading.readToEnd()) ?? Data()
        }

        func finish() -> Int32 {
            closeInput()
            process.waitUntilExit()
            return process.terminationStatus
        }
    }

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

    @Test("without the app the helper answers app.unavailable and exits cleanly")
    func withoutTheAppTheHelperAnswersAppUnavailableAndExitsCleanly() throws {
        let helper = try Helper(socketPath: FakeBridgeApp.absentSocketPath())
        helper.write(Self.frame(Self.hello))

        let reply = try #require(helper.readFrame())

        #expect(
            String(decoding: reply, as: UTF8.self)
                == #"{"id":"app-unavailable","payload":{},"type":"app.unavailable","v":1}"#)
        #expect(helper.finish() == 0)
    }

    @Test("a hello reaches the app and its reply comes back framed")
    func aHelloReachesTheAppAndItsReplyComesBackFramed() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)

        helper.write(Self.frame(Self.hello))
        #expect(app.accept())
        #expect(app.readLine() == Data(Self.hello.utf8))
        app.sendLine(Self.ack)

        #expect(helper.readFrame() == Data(Self.ack.utf8))
        #expect(helper.finish() == 0)
    }

    @Test("every message is relayed in order, byte for byte, both ways")
    func everyMessageIsRelayedInOrderByteForByteBothWays() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)
        let focus = #"{"v":1,"id":"f1","type":"browser.focus","payload":{"focused":true}}"#
        let state = #"{"v":1,"id":"s1","type":"focusSession.state","payload":{"active":false,"endsAt":null}}"#

        helper.write(Self.frame(Self.hello) + Self.frame(focus))
        #expect(app.accept())
        #expect(app.readLine() == Data(Self.hello.utf8))
        #expect(app.readLine() == Data(focus.utf8))
        app.send(Data((Self.ack + "\n" + state + "\n").utf8))

        #expect(helper.readFrame() == Data(Self.ack.utf8))
        #expect(helper.readFrame() == Data(state.utf8))
        #expect(helper.finish() == 0)
    }

    @Test("the app closing the socket ends the relay cleanly")
    func theAppClosingTheSocketEndsTheRelayCleanly() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)
        helper.write(Self.frame(Self.hello))
        #expect(app.accept())
        _ = app.readLine()

        app.hangUp()
        helper.process.waitUntilExit()

        #expect(helper.process.terminationStatus == 0)
        #expect(helper.remainingOutput().isEmpty)
    }

    @Test("a message the extension may not send is never relayed")
    func aMessageTheExtensionMayNotSendIsNeverRelayed() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)
        let unlock =
            #"{"v":1,"id":"u1","type":"unlock.token","payload":{"token":"v4.public.c3ludGhldGlj.Zm9vdGVy"}}"#

        helper.write(Self.frame(unlock))
        #expect(app.accept())

        #expect(app.readLine() == nil)
        #expect(helper.finish() != 0)
    }

    @Test("a message the app may not send is never relayed")
    func aMessageTheAppMayNotSendIsNeverRelayed() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)
        helper.write(Self.frame(Self.hello))
        #expect(app.accept())
        _ = app.readLine()

        app.sendLine(#"{"v":1,"id":"x1","type":"browser.activity","payload":{}}"#)
        helper.process.waitUntilExit()

        #expect(helper.process.terminationStatus != 0)
        #expect(helper.remainingOutput().isEmpty)
    }

    @Test("a line from the app over 1 MiB is never relayed")
    func aLineFromTheAppOver1MiBIsNeverRelayed() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)
        helper.write(Self.frame(Self.hello))
        #expect(app.accept())
        _ = app.readLine()

        let padding = String(repeating: "x", count: Self.maxPayloadBytes)
        app.sendLine(
            #"{"v":1,"id":"r1","type":"rules.snapshot","payload":{"issuedAt":"2026-01-05T09:00:00Z","ruleset":{"p":"\#(padding)"}}}"#
        )
        helper.process.waitUntilExit()

        #expect(helper.process.terminationStatus != 0)
        #expect(helper.remainingOutput().isEmpty)
    }

    @Test("an oversized length prefix is refused before the payload")
    func anOversizedLengthPrefixIsRefusedBeforeThePayload() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)

        helper.write(Self.header(UInt32(Self.maxPayloadBytes + 1)))
        #expect(app.accept())

        #expect(app.readLine() == nil)
        #expect(helper.finish() != 0)
    }

    @Test("a payload that is not JSON is refused")
    func aPayloadThatIsNotJSONIsRefused() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)

        helper.write(Self.frame("not json"))
        #expect(app.accept())

        #expect(app.readLine() == nil)
        #expect(helper.finish() != 0)
    }

    @Test("a payload shorter than its length prefix is refused")
    func aPayloadShorterThanItsLengthPrefixIsRefused() throws {
        let app = try FakeBridgeApp()
        let helper = try Helper(socketPath: app.socketPath)
        helper.write(Self.header(10) + Data("{}".utf8))
        #expect(app.accept())

        #expect(helper.finish() != 0)
        #expect(app.readLine() == nil)
    }
}
