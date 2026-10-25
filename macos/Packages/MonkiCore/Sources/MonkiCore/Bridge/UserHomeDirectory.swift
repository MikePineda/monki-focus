// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin

/// The user's home folder from the user database (`getpwuid`), shared by the
/// app and `monki-bridge` so both agree on the socket path. Never `$HOME` or
/// `CFFIXED_USER_HOME` (which `homeDirectoryForCurrentUser` honours): the
/// browser that launches the helper controls its environment.
///
/// The one system read in MonkiCore, kept here because the helper links
/// only this module.
public enum UserHomeDirectory {
    public static func path() -> String? {
        guard let entry = getpwuid(getuid()), let directory = entry.pointee.pw_dir else { return nil }
        let path = String(cString: directory)
        return path.hasPrefix("/") ? path : nil
    }

    /// The bridge socket of this user (`BridgeSocketPath.path(home:)`).
    public static func bridgeSocketPath() -> String? {
        guard let home = path() else { return nil }
        return try? BridgeSocketPath.path(home: home)
    }
}
