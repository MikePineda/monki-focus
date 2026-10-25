// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Dispatch
import Foundation
import MonkiCore
import os

/// The app side of the bridge: a Unix socket `monki-bridge` connects to.
///
/// - The socket file is 0600 inside a 0700 folder owned by the user, with no
///   ACL (`BridgeSocketDirectory`), so only the user's own processes can
///   reach it. A socket a running app still answers on is never taken over.
/// - Every accepted peer must run as the same user (`getpeereid`); anyone
///   else is disconnected before a byte is read.
/// - At most `maxConnections` connections at once (one per browser profile
///   in practice). When full, the oldest connection that never sent a valid
///   `hello` makes room, so silent squatters cannot lock the helper out;
///   when every connection said hello, the newcomer is refused.
/// - Each connection validates every line as a message from the extension,
///   is rate limited and closes on a missing `hello`, on idleness or on
///   malformed input, without touching the others (`BridgeConnection`).
///
/// There is no command channel: the handler only sees `hello`,
/// `browser.focus`, `browser.activity` and `bypass.event`.
public final class BridgeSocketServer: Sendable {
    public struct Configuration: Sendable {
        public var socketPath: String
        public var maxConnections: Int
        public var limits: BridgeConnectionLimits
        /// The only user id allowed to connect (this process's own by default).
        public var allowedUserId: uid_t

        public init(
            socketPath: String, maxConnections: Int = 4, limits: BridgeConnectionLimits = BridgeConnectionLimits(),
            allowedUserId: uid_t = getuid()
        ) {
            self.socketPath = socketPath
            self.maxConnections = maxConnections
            self.limits = limits
            self.allowedUserId = allowedUserId
        }
    }

    public enum Failure: Error, Equatable {
        /// This server already listens, or another app answers on the socket.
        case alreadyRunning
        case invalidPath
        case directory
        case system(errno: Int32)
    }

    private struct State {
        var listener: Int32 = -1
        var acceptSource: (any DispatchSourceRead)?
        var connections: [ObjectIdentifier: BridgeConnection] = [:]
        var nextSequence: UInt64 = 0
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

    /// The socket of this user, under the home folder from the user database
    /// (the same helper `monki-bridge` uses).
    public static func defaultSocketPath() throws(Failure) -> String {
        guard let path = UserHomeDirectory.bridgeSocketPath() else { throw .invalidPath }
        return path
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
        } catch {
            throw .invalidPath
        }
        do throws(BridgeSocketDirectory.Failure) {
            try BridgeSocketDirectory.prepare(socketPath: path, owner: configuration.allowedUserId)
        } catch .inUse {
            throw .alreadyRunning
        } catch {
            throw .directory
        }

        let listener = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard listener >= 0 else { throw .system(errno: errno) }
        var bound = false
        do throws(Failure) {
            try Self.configure(listener)
            guard UnixSocketAddress.withSockaddr(address, { Darwin.bind(listener, $0, $1) }) == 0 else {
                throw Failure.system(errno: errno)
            }
            bound = true
            // The 0700 folder already keeps everyone else out; 0600 is the second lock.
            guard chmod(path, 0o600) == 0 else { throw Failure.system(errno: errno) }
            guard listen(listener, Int32(configuration.maxConnections)) == 0 else { throw Failure.system(errno: errno) }
            guard fcntl(listener, F_SETFL, fcntl(listener, F_GETFL) | O_NONBLOCK) == 0 else {
                throw Failure.system(errno: errno)
            }
        } catch {
            Darwin.close(listener)
            // Only the socket this call created; never a path someone else owns.
            if bound { unlink(path) }
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

    /// Sends `message` (an app-to-extension type) to every connection that said `hello`.
    public func broadcast(_ message: BridgeMessage) {
        guard message.type.direction == .appToExtension else { return }
        state.withLock { Array($0.connections.values) }.filter(\.hasGreeted).forEach { $0.send(message) }
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
        let sequence = state.withLock { state in
            state.nextSequence += 1
            return state.nextSequence
        }
        let connection = BridgeConnection(
            socket: socket, sequence: sequence, handler: handler, limits: configuration.limits
        ) { [weak self] closed in
            self?.state.withLock { _ = $0.connections.removeValue(forKey: ObjectIdentifier(closed)) }
        }
        let (admitted, evicted) = state.withLock { state -> (Bool, BridgeConnection?) in
            guard state.listener >= 0 else { return (false, nil) }
            var evicted: BridgeConnection?
            if state.connections.count >= configuration.maxConnections {
                guard
                    let oldest = state.connections.values.filter({ !$0.hasGreeted }).min(by: {
                        $0.sequence < $1.sequence
                    })
                else { return (false, nil) }
                state.connections.removeValue(forKey: ObjectIdentifier(oldest))
                evicted = oldest
            }
            state.connections[ObjectIdentifier(connection)] = connection
            return (true, evicted)
        }
        if let evicted {
            BridgeLog.event("connection limit reached; oldest connection without hello closed")
            evicted.close()
        }
        guard admitted else {
            BridgeLog.event("connection limit reached; connection refused")
            Darwin.close(socket)
            return
        }
        connection.start()
    }
}
