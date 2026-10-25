// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin

/// A `sockaddr_un` for a filesystem socket path, shared by the app's server
/// and `monki-bridge`. Building the address is pure; binding or connecting
/// it is the caller's I/O.
public enum UnixSocketAddress {
    /// The address of `path`, which `BridgeSocketPath.validated` must accept.
    public static func make(path: String) throws(BridgeSocketPath.Failure) -> sockaddr_un {
        let path = try BridgeSocketPath.validated(path)
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        withUnsafeMutableBytes(of: &address.sun_path) { buffer in
            for (index, byte) in path.utf8.enumerated() {
                buffer[index] = byte
            }
            buffer[path.utf8.count] = 0
        }
        return address
    }

    /// Runs `body` with `address` as the generic `sockaddr` pointer the socket calls take.
    public static func withSockaddr<T>(
        _ address: sockaddr_un, _ body: (UnsafePointer<sockaddr>, socklen_t) -> T
    ) -> T {
        var address = address
        return withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                body($0, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
    }
}
