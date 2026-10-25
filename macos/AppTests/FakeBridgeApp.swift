// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation

/// Stands in for the menu-bar app at the far end of `monki-bridge`: a Unix
/// socket in a private temporary folder that accepts one connection and
/// speaks NDJSON. Every wait has a timeout, so a broken helper fails the
/// test instead of hanging it. Written with plain POSIX calls on purpose:
/// it checks the helper against the wire format, not against our own server.
final class FakeBridgeApp {
    struct Failure: Error {
        let reason: String
    }

    let directory: String
    let socketPath: String
    private let listener: Int32
    private var connection: Int32 = -1
    private var pending = Data()

    init() throws {
        directory = "/tmp/mf-app-\(UUID().uuidString.prefix(8))"
        socketPath = directory + "/bridge.sock"
        guard mkdir(directory, 0o700) == 0 else { throw Failure(reason: "mkdir errno \(errno)") }
        listener = socket(AF_UNIX, SOCK_STREAM, 0)
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &address.sun_path) { buffer in
            for (index, byte) in socketPath.utf8.enumerated() { buffer[index] = byte }
        }
        let bound = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(listener, $0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard bound == 0, listen(listener, 1) == 0 else { throw Failure(reason: "bind errno \(errno)") }
    }

    deinit {
        if connection >= 0 { Darwin.close(connection) }
        Darwin.close(listener)
        unlink(socketPath)
        rmdir(directory)
    }

    /// A socket path in a folder that does not exist (no app running).
    static func absentSocketPath() -> String {
        "/tmp/mf-none-\(UUID().uuidString.prefix(8))/bridge.sock"
    }

    /// Waits for the helper to connect.
    func accept(timeout: Int32 = 5_000) -> Bool {
        guard wait(listener, timeout: timeout) else { return false }
        connection = Darwin.accept(listener, nil, nil)
        var on: Int32 = 1
        setsockopt(connection, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
        return connection >= 0
    }

    /// The next line the helper relayed, or nil on close or timeout.
    func readLine(timeout: Int32 = 3_000) -> Data? {
        while true {
            if let newline = pending.firstIndex(of: UInt8(ascii: "\n")) {
                let line = Data(pending[pending.startIndex..<newline])
                pending = Data(pending[pending.index(after: newline)...])
                return line
            }
            guard connection >= 0, wait(connection, timeout: timeout) else { return nil }
            var chunk = [UInt8](repeating: 0, count: 65_536)
            let count = chunk.withUnsafeMutableBytes { Darwin.read(connection, $0.baseAddress, $0.count) }
            guard count > 0 else { return nil }
            pending.append(contentsOf: chunk[0..<count])
        }
    }

    func send(_ bytes: Data) {
        var offset = 0
        while offset < bytes.count {
            let written = bytes.withUnsafeBytes {
                Darwin.write(connection, $0.baseAddress?.advanced(by: offset), $0.count - offset)
            }
            guard written > 0 else { return }
            offset += written
        }
    }

    func sendLine(_ json: String) {
        send(Data(json.utf8) + Data("\n".utf8))
    }

    /// The app quits: the helper sees the socket close.
    func hangUp() {
        if connection >= 0 { Darwin.close(connection) }
        connection = -1
    }

    private func wait(_ descriptor: Int32, timeout: Int32) -> Bool {
        var entry = pollfd(fd: descriptor, events: Int16(POLLIN), revents: 0)
        return poll(&entry, 1, timeout) == 1
    }
}
