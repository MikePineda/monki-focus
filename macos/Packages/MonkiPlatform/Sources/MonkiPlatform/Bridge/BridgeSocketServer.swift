// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Dispatch
import Foundation
import MonkiCore
import os

/// The app side of the bridge: a Unix socket `monki-bridge` connects to.
///
/// - The socket file is 0600 inside a 0700 folder owned by the user
///   (`BridgeSocketDirectory`), so only the user's own processes can reach it.
/// - Every accepted peer must run as the same user (`getpeereid`); anyone
///   else is disconnected before a byte is read.
/// - At most `maxConnections` connections at once (one per browser profile
///   in practice); more are closed at accept.
/// - Each connection validates every line as a message from the extension;
///   malformed input closes that connection only.
///
/// There is no command channel: the handler only sees `hello`,
/// `browser.focus`, `browser.activity` and `bypass.event`.
public final class BridgeSocketServer: Sendable {
    public struct Configuration: Sendable {
        public var socketPath: String
        public var maxConnections: Int
        public var writeTimeoutMilliseconds: Int32
        /// The only user id allowed to connect (this process's own by default).
        public var allowedUserId: uid_t

        public init(
            socketPath: String, maxConnections: Int = 4, writeTimeoutMilliseconds: Int32 = 5_000,
            allowedUserId: uid_t = getuid()
        ) {
            self.socketPath = socketPath
            self.maxConnections = maxConnections
            self.writeTimeoutMilliseconds = writeTimeoutMilliseconds
            self.allowedUserId = allowedUserId
        }
    }

    public enum Failure: Error, Equatable {
        case alreadyRunning
        case invalidPath
        case directory
        case system(errno: Int32)
    }

    private struct State {
        var listener: Int32 = -1
        var acceptSource: (any DispatchSourceRead)?
        var connections: [ObjectIdentifier: BridgeConnection] = [:]
    }

    private let configuration: Configuration
    private let handler: any BridgeMessageHandler
    private let peers: any PeerIdentity
    private let queue = DispatchQueue(label: "dev.monkifocus.bridge.accept")
    private let state = OSAllocatedUnfairLock(initialState: State())

    public init(
        configuration: Configuration, handler: any BridgeMessageHandler,
        peers: any PeerIdentity = SocketPeerIdentity()
    ) {
        self.configuration = configuration
        self.handler = handler
        self.peers = peers
    }

    /// The default socket of this user.
    public static func defaultSocketPath() throws -> String {
        try BridgeSocketPath.path(home: FileManager.default.homeDirectoryForCurrentUser.path)
    }

    public var connectionCount: Int {
        state.withLock { $0.connections.count }
    }

    public var isRunning: Bool {
        state.withLock { $0.listener >= 0 }
    }

    public func start() throws(Failure) {
        guard !isRunning else { throw .alreadyRunning }
        let path = configuration.socketPath
        let address: sockaddr_un
        do {
            address = try UnixSocketAddress.make(path: path)
            try BridgeSocketDirectory.prepare(socketPath: path, owner: configuration.allowedUserId)
        } catch is BridgeSocketPath.Failure {
            throw .invalidPath
        } catch {
            throw .directory
        }

        let listener = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard listener >= 0 else { throw .system(errno: errno) }
        do throws(Failure) {
            try Self.configure(listener)
            let bound = UnixSocketAddress.withSockaddr(address) { Darwin.bind(listener, $0, $1) }
            guard bound == 0 else { throw Failure.system(errno: errno) }
            // The 0700 folder already keeps everyone else out; 0600 is the second lock.
            guard chmod(path, 0o600) == 0 else { throw Failure.system(errno: errno) }
            guard listen(listener, Int32(configuration.maxConnections)) == 0 else { throw Failure.system(errno: errno) }
            guard fcntl(listener, F_SETFL, fcntl(listener, F_GETFL) | O_NONBLOCK) == 0 else {
                throw Failure.system(errno: errno)
            }
        } catch {
            Darwin.close(listener)
            unlink(path)
            throw error
        }

        let source = DispatchSource.makeReadSource(fileDescriptor: listener, queue: queue)
        source.setEventHandler { [weak self] in self?.acceptPending(listener) }
        source.setCancelHandler { Darwin.close(listener) }
        state.withLock {
            $0.listener = listener
            $0.acceptSource = source
        }
        source.resume()
        BridgeLog.event("bridge socket listening")
    }

    /// Stops listening, closes every connection and removes the socket file.
    public func stop() {
        let (source, connections) = state.withLock { state in
            let taken = (state.acceptSource, Array(state.connections.values))
            state = State()
            return taken
        }
        guard let source else { return }
        source.cancel()
        connections.forEach { $0.close() }
        unlink(configuration.socketPath)
    }

    /// Sends `message` (an app-to-extension type) to every connection.
    public func broadcast(_ message: BridgeMessage) {
        guard message.type.direction == .appToExtension else { return }
        state.withLock { Array($0.connections.values) }.forEach { $0.send(message) }
    }

    private static func configure(_ socket: Int32) throws(Failure) {
        var on: Int32 = 1
        guard setsockopt(socket, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size)) == 0,
            fcntl(socket, F_SETFD, FD_CLOEXEC) == 0
        else { throw .system(errno: errno) }
    }

    private func acceptPending(_ listener: Int32) {
        while true {
            let socket = Darwin.accept(listener, nil, nil)
            guard socket >= 0 else {
                if errno != EAGAIN, errno != EWOULDBLOCK, errno != EINTR {
                    BridgeLog.failure("accept failed", errno: errno)
                }
                return
            }
            admit(socket)
        }
    }

    private func admit(_ socket: Int32) {
        guard peers.userId(ofPeer: socket) == configuration.allowedUserId else {
            BridgeLog.event("peer of another user refused")
            Darwin.close(socket)
            return
        }
        do throws(Failure) {
            try Self.configure(socket)
            guard fcntl(socket, F_SETFL, fcntl(socket, F_GETFL) | O_NONBLOCK) == 0 else {
                throw Failure.system(errno: errno)
            }
        } catch {
            BridgeLog.failure("connection setup failed", error)
            Darwin.close(socket)
            return
        }
        let connection = BridgeConnection(
            socket: socket, handler: handler, writeTimeoutMilliseconds: configuration.writeTimeoutMilliseconds
        ) { [weak self] closed in
            self?.state.withLock { _ = $0.connections.removeValue(forKey: ObjectIdentifier(closed)) }
        }
        let admitted = state.withLock { state in
            guard state.listener >= 0, state.connections.count < configuration.maxConnections else { return false }
            state.connections[ObjectIdentifier(connection)] = connection
            return true
        }
        guard admitted else {
            BridgeLog.event("connection limit reached; connection refused")
            Darwin.close(socket)
            return
        }
        connection.start()
    }
}
