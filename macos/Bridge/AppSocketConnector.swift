// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation
import MonkiCore

/// Connects `monki-bridge` to the app's socket.
enum AppSocketConnector {
    enum Outcome {
        case connected(Int32)
        /// No socket, or nobody listening: the app is not running.
        case appUnavailable
        /// Something listens that is not run by this user.
        case refused
    }

    /// The socket path. Debug builds (the test runs) may point the helper
    /// at another socket with `MONKI_BRIDGE_SOCKET_PATH`; release builds only
    /// ever use the user's own Application Support folder.
    static func socketPath() -> String? {
        #if DEBUG
            if let override = ProcessInfo.processInfo.environment["MONKI_BRIDGE_SOCKET_PATH"], !override.isEmpty {
                return try? BridgeSocketPath.validated(override)
            }
        #endif
        return UserHomeDirectory.bridgeSocketPath()
    }

    static func connect(path: String) -> Outcome {
        guard let address = try? UnixSocketAddress.make(path: path) else { return .appUnavailable }
        let socket = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard socket >= 0 else { return .appUnavailable }
        var on: Int32 = 1
        _ = setsockopt(socket, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
        _ = fcntl(socket, F_SETFD, FD_CLOEXEC)
        let connected = UnixSocketAddress.withSockaddr(address) { Darwin.connect(socket, $0, $1) }
        guard connected == 0 else {
            Darwin.close(socket)
            return .appUnavailable
        }
        // The app must run as this same user, like the app checks of us.
        var uid: uid_t = 0
        var gid: gid_t = 0
        guard getpeereid(socket, &uid, &gid) == 0, uid == getuid() else {
            Darwin.close(socket)
            return .refused
        }
        return .connected(socket)
    }
}
