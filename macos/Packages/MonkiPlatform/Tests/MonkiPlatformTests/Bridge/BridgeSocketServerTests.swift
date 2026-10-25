// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation
import MonkiCore
import MonkiPlatform
import Testing

/// The app's Unix socket, with real sockets in a private temporary folder.
@Suite("bridge socket server", .serialized)
final class BridgeSocketServerTests {
    private let folder = TemporarySocketFolder()
    private let handler = RecordingBridgeHandler()
    private var server: BridgeSocketServer?

    deinit {
        server?.stop()
        folder.remove()
    }

    private static let hello =
        #"{"v":1,"id":"h1","type":"hello","payload":{"extensionVersion":"0.1.0","schemaVersion":1,"browser":"brave"}}"#
    private static let focus = #"{"v":1,"id":"f1","type":"browser.focus","payload":{"focused":true}}"#

    @discardableResult
    private func start(
        maxConnections: Int = 4, limits: BridgeConnectionLimits = BridgeConnectionLimits(),
        peers: any PeerIdentity = SocketPeerIdentity()
    ) throws -> BridgeSocketServer {
        let server = BridgeSocketServer(
            configuration: .init(socketPath: folder.socketPath, maxConnections: maxConnections, limits: limits),
            handler: handler, peers: peers)
        try server.start()
        self.server = server
        return server
    }

    private func mode(_ path: String) -> mode_t {
        var info = stat()
        lstat(path, &info)
        return info.st_mode & 0o777
    }

    private func eventually(_ condition: () -> Bool) async throws -> Bool {
        for _ in 0..<100 {
            if condition() { return true }
            try await Task.sleep(for: .milliseconds(20))
        }
        return condition()
    }

    @Test("the socket is 0600 inside a 0700 folder")
    func theSocketIs0600InsideA0700Folder() throws {
        try start()

        #expect(mode(folder.socketPath) == 0o600)
        #expect(mode(folder.directory.path) == 0o700)
    }

    @Test("a hello is answered with hello.ack naming the mac aggregator")
    func aHelloIsAnsweredWithHelloAckNamingTheMacAggregator() throws {
        try start()
        let client = try BridgeTestClient(path: folder.socketPath)

        client.send(Self.hello)

        #expect(try client.nextMessage() == .helloAck(HelloAckPayload(appVersion: "0.1.0")))
    }

    @Test("a malformed line closes that connection only")
    func aMalformedLineClosesThatConnectionOnly() throws {
        try start()
        let broken = try BridgeTestClient(path: folder.socketPath)
        let healthy = try BridgeTestClient(path: folder.socketPath)

        broken.send("{not json")
        healthy.send(Self.hello)

        #expect(try broken.waitForClose())
        #expect(try healthy.nextMessage() != nil)
    }

    @Test("a message that would change rules or unlock never reaches the handler")
    func aMessageThatWouldChangeRulesOrUnlockNeverReachesTheHandler() throws {
        try start()
        let client = try BridgeTestClient(path: folder.socketPath)

        client.send(
            #"{"v":1,"id":"r1","type":"rules.snapshot","payload":{"issuedAt":"2026-01-05T09:00:00Z","ruleset":{}}}"#)

        #expect(try client.waitForClose())
        #expect(handler.messages.isEmpty)
    }

    @Test("a line over 1 MiB closes the connection")
    func aLineOver1MiBClosesTheConnection() throws {
        try start()
        let client = try BridgeTestClient(path: folder.socketPath)

        client.send(Data(repeating: UInt8(ascii: "x"), count: BridgeContract.maxMessageBytes + 2))

        #expect(try client.waitForClose())
        #expect(handler.messages.isEmpty)
    }

    @Test("a peer of another user is refused before anything is read")
    func aPeerOfAnotherUserIsRefusedBeforeAnythingIsRead() throws {
        try start(peers: OtherUserPeers())
        let client = try BridgeTestClient(path: folder.socketPath)

        client.send(Self.focus)

        #expect(try client.waitForClose())
        #expect(handler.messages.isEmpty)
    }

    @Test("when every connection said hello, a newcomer over the limit is refused")
    func whenEveryConnectionSaidHelloANewcomerOverTheLimitIsRefused() async throws {
        let server = try start(maxConnections: 2)
        let first = try BridgeTestClient(path: folder.socketPath)
        let second = try BridgeTestClient(path: folder.socketPath)
        first.send(Self.hello)
        second.send(Self.hello)
        #expect(try first.nextMessage() != nil)
        #expect(try second.nextMessage() != nil)

        let third = try BridgeTestClient(path: folder.socketPath)

        #expect(try third.waitForClose())
        #expect(server.connectionCount == 2)
        first.send(Self.focus)
        #expect(try await eventually { self.handler.messages.count == 3 })
    }

    @Test("silent squatters cannot lock the real helper out")
    func silentSquattersCannotLockTheRealHelperOut() async throws {
        let server = try start(maxConnections: 2)
        let squatters = [try BridgeTestClient(path: folder.socketPath), try BridgeTestClient(path: folder.socketPath)]
        #expect(try await eventually { server.connectionCount == 2 })

        let helper = try BridgeTestClient(path: folder.socketPath)
        helper.send(Self.hello)

        #expect(try helper.nextMessage() == .helloAck(HelloAckPayload(appVersion: "0.1.0")))
        #expect(try squatters[0].waitForClose())
    }

    @Test("a connection that never says hello is closed after the hello timeout")
    func aConnectionThatNeverSaysHelloIsClosedAfterTheHelloTimeout() throws {
        try start(limits: BridgeConnectionLimits(helloTimeoutSeconds: 0.2))
        let silent = try BridgeTestClient(path: folder.socketPath)
        let focusOnly = try BridgeTestClient(path: folder.socketPath)

        focusOnly.send(Self.focus)

        #expect(try silent.waitForClose(timeout: .seconds(2)))
        #expect(try focusOnly.waitForClose(timeout: .seconds(2)))
    }

    @Test("an idle connection is closed after the idle timeout")
    func anIdleConnectionIsClosedAfterTheIdleTimeout() throws {
        try start(limits: BridgeConnectionLimits(helloTimeoutSeconds: 5, idleTimeoutSeconds: 0.3))
        let client = try BridgeTestClient(path: folder.socketPath)
        client.send(Self.hello)
        #expect(try client.nextMessage() != nil)

        #expect(try client.waitForClose(timeout: .seconds(3)))
    }

    @Test("a flood is cut to the rate limit and the excess dropped, not answered")
    func aFloodIsCutToTheRateLimitAndTheExcessDroppedNotAnswered() async throws {
        try start(limits: BridgeConnectionLimits(messagesPerSecond: 0.001, burst: 3))
        let client = try BridgeTestClient(path: folder.socketPath)

        client.send(Data(String(repeating: Self.hello + "\n", count: 20).utf8))

        for _ in 0..<3 { #expect(try client.nextMessage() != nil) }
        #expect(try client.nextLine(timeout: .milliseconds(300)) == nil)
        #expect(!client.isClosedByServer)
        #expect(handler.messages.count == 3)
    }

    @Test("a broadcast skips connections that never said hello")
    func aBroadcastSkipsConnectionsThatNeverSaidHello() async throws {
        let server = try start()
        let greeted = try BridgeTestClient(path: folder.socketPath)
        let silent = try BridgeTestClient(path: folder.socketPath)
        greeted.send(Self.hello)
        #expect(try greeted.nextMessage() != nil)
        #expect(try await eventually { server.connectionCount == 2 })
        let state = FocusSessionStatePayload(endsAt: nil)

        server.broadcast(.focusSessionState(state))

        #expect(try greeted.nextMessage() == .focusSessionState(state))
        #expect(try silent.nextLine(timeout: .milliseconds(300)) == nil)
    }

    @Test("a socket a running app answers on is never taken over")
    func aSocketARunningAppAnswersOnIsNeverTakenOver() throws {
        try start()
        let second = BridgeSocketServer(configuration: .init(socketPath: folder.socketPath), handler: handler)

        #expect(throws: BridgeSocketServer.Failure.alreadyRunning) { try second.start() }

        let client = try BridgeTestClient(path: folder.socketPath)
        client.send(Self.hello)
        #expect(try client.nextMessage() != nil)
    }

    @Test("a folder with an ACL entry or a symlinked folder is refused")
    func aFolderWithAnACLEntryOrASymlinkedFolderIsRefused() throws {
        try FileManager.default.createDirectory(
            at: folder.directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let chmod = Process()
        chmod.executableURL = URL(filePath: "/bin/chmod")
        chmod.arguments = ["+a", "everyone allow list", folder.directory.path]
        try chmod.run()
        chmod.waitUntilExit()
        #expect(chmod.terminationStatus == 0)

        #expect(throws: BridgeSocketServer.Failure.directory) { try self.start() }

        let elsewhere = TemporarySocketFolder()
        defer { elsewhere.remove() }
        try FileManager.default.createDirectory(
            at: elsewhere.directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try FileManager.default.removeItem(at: folder.directory)
        try FileManager.default.createSymbolicLink(at: folder.directory, withDestinationURL: elsewhere.directory)

        #expect(throws: BridgeSocketServer.Failure.directory) { try self.start() }
        #expect(!FileManager.default.fileExists(atPath: elsewhere.socketPath))
    }

    @Test("a closed connection frees its slot")
    func aClosedConnectionFreesItsSlot() async throws {
        let server = try start(maxConnections: 1)
        var first: BridgeTestClient? = try BridgeTestClient(path: folder.socketPath)
        #expect(try await eventually { server.connectionCount == 1 })
        _ = first

        first = nil

        #expect(try await eventually { server.connectionCount == 0 })
        let next = try BridgeTestClient(path: folder.socketPath)
        next.send(Self.hello)
        #expect(try next.nextMessage() != nil)
    }

    @Test("a broadcast reaches every connection and only app messages go out")
    func aBroadcastReachesEveryConnectionAndOnlyAppMessagesGoOut() async throws {
        let server = try start()
        let first = try BridgeTestClient(path: folder.socketPath)
        let second = try BridgeTestClient(path: folder.socketPath)
        first.send(Self.hello)
        second.send(Self.hello)
        #expect(try first.nextMessage() != nil)
        #expect(try second.nextMessage() != nil)
        let state = FocusSessionStatePayload(endsAt: "2026-01-05T09:30:00Z")

        server.broadcast(.browserFocus(BrowserFocusPayload(focused: true)))
        server.broadcast(.focusSessionState(state))

        #expect(try first.nextMessage() == .focusSessionState(state))
        #expect(try second.nextMessage() == .focusSessionState(state))
    }

    @Test("a stale socket is replaced, any other file at the path is refused")
    func aStaleSocketIsReplacedAnyOtherFileAtThePathIsRefused() throws {
        try FileManager.default.createDirectory(
            at: folder.directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let leftover = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        let address = try UnixSocketAddress.make(path: folder.socketPath)
        #expect(UnixSocketAddress.withSockaddr(address) { Darwin.bind(leftover, $0, $1) } == 0)
        Darwin.close(leftover)

        let server = try start()
        let client = try BridgeTestClient(path: folder.socketPath)
        client.send(Self.hello)
        #expect(try client.nextMessage() != nil)
        server.stop()

        FileManager.default.createFile(atPath: folder.socketPath, contents: Data("keep".utf8))
        #expect(throws: BridgeSocketServer.Failure.directory) { try self.start() }
        #expect(FileManager.default.contents(atPath: folder.socketPath) == Data("keep".utf8))
    }

    @Test("stopping removes the socket file")
    func stoppingRemovesTheSocketFile() throws {
        let server = try start()

        server.stop()

        #expect(!FileManager.default.fileExists(atPath: folder.socketPath))
        #expect(!server.isRunning)
    }

    @Test("a folder opened up by someone is locked down again")
    func aFolderOpenedUpBySomeoneIsLockedDownAgain() throws {
        try FileManager.default.createDirectory(
            at: folder.directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o755])

        try start()

        #expect(mode(folder.directory.path) == 0o700)
    }
}
