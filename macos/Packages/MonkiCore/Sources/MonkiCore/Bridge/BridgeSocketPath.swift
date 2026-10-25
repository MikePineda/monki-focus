// SPDX-License-Identifier: AGPL-3.0-or-later

/// Where the app listens and `monki-bridge` connects:
/// `~/Library/Application Support/monki-focus/bridge.sock`, inside the
/// user's 0700 data folder.
public enum BridgeSocketPath {
    public enum Failure: Error, Equatable, Sendable {
        /// The path does not fit `sockaddr_un.sun_path`.
        case tooLong(byteCount: Int)
        case notAbsolute
    }

    /// The socket path under `home` (the user's home folder, absolute).
    public static func path(home: String) throws(Failure) -> String {
        let trimmed = home.hasSuffix("/") ? String(home.dropLast()) : home
        return try validated("\(trimmed)/\(BridgeContract.socketPathInHome)")
    }

    /// `path` when it is absolute and fits a Unix socket address.
    public static func validated(_ path: String) throws(Failure) -> String {
        guard path.hasPrefix("/") else { throw .notAbsolute }
        guard path.utf8.count <= BridgeContract.maxSocketPathBytes else {
            throw .tooLong(byteCount: path.utf8.count)
        }
        return path
    }
}
