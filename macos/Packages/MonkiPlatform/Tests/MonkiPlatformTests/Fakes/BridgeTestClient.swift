// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation
import MonkiCore

/// Plays `monki-bridge` against a real `BridgeSocketServer`: connects to the
/// socket, writes NDJSON lines and reads replies with a timeout, so a broken
/// server fails the test instead of hanging it.
final class BridgeTestClient {
    struct Failure: Error {
        let reason: String
    }

    private let socket: Int32
    private var lines = BridgeLineBuffer(maxLineBytes: 4 * 1_048_576)
    private var received: [Data] = []
    private(set) var isClosedByServer = false

    init(path: String) throws {
        socket = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        var on: Int32 = 1
        setsockopt(socket, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
        let address = try UnixSocketAddress.make(path: path)
        let connected = UnixSocketAddress.withSockaddr(address) { Darwin.connect(socket, $0, $1) }
        guard connected == 0 else {
            Darwin.close(socket)
            throw Failure(reason: "connect errno \(errno)")
        }
    }

    deinit {
        Darwin.close(socket)
    }

    func send(_ line: String) {
        send(Data(line.utf8) + Data("\n".utf8))
    }

    func send(_ bytes: Data) {
        var offset = 0
        while offset < bytes.count {
            let written = bytes.withUnsafeBytes {
                Darwin.write(socket, $0.baseAddress?.advanced(by: offset), $0.count - offset)
            }
            guard written > 0 else { return }
            offset += written
        }
    }

    /// The next reply line, or nil when the server closed the connection or `timeout` passed.
    func nextLine(timeout: Duration = .seconds(3)) throws -> Data? {
        let deadline = ContinuousClock.now + timeout
        while received.isEmpty {
            let remaining = deadline - ContinuousClock.now
            guard remaining > .zero, !isClosedByServer else { return nil }
            var descriptor = pollfd(fd: socket, events: Int16(POLLIN), revents: 0)
            let milliseconds = Int32(
                remaining.components.seconds * 1000 + remaining.components.attoseconds / 1_000_000_000_000_000)
            guard poll(&descriptor, 1, max(milliseconds, 1)) == 1 else { continue }
            var chunk = [UInt8](repeating: 0, count: 65_536)
            let count = chunk.withUnsafeMutableBytes { Darwin.read(socket, $0.baseAddress, $0.count) }
            guard count > 0 else {
                isClosedByServer = true
                return nil
            }
            received += try lines.append(Data(chunk[0..<count]))
        }
        return received.removeFirst()
    }

    /// The next reply, decoded as a message from the app.
    func nextMessage(timeout: Duration = .seconds(3)) throws -> BridgeMessage? {
        guard let line = try nextLine(timeout: timeout) else { return nil }
        return try BridgeMessage.decode(line, from: .appToExtension)
    }

    /// Waits for the server to hang up; true when it did within `timeout`.
    func waitForClose(timeout: Duration = .seconds(3)) throws -> Bool {
        while try nextLine(timeout: timeout) != nil {}
        return isClosedByServer
    }
}
