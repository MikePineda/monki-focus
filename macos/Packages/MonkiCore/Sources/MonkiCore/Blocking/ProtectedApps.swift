// SPDX-License-Identifier: AGPL-3.0-or-later

/// Apps the Mac never hides, whatever the rules say: monki-focus itself, the
/// system apps needed to change settings, quit or remove it (leaving is
/// always possible from the device), the system's own UI processes, and the
/// user's allowlist.
public struct ProtectedApps: Hashable, Sendable {
    /// System bundle ids needed to leave: settings, Finder (to remove the
    /// app), Activity Monitor (to quit it) and the system UI.
    public static let neededToLeave: Set<String> = [
        "com.apple.systempreferences",
        "com.apple.finder",
        "com.apple.ActivityMonitor",
        "com.apple.loginwindow",
        "com.apple.dock",
        "com.apple.SecurityAgent",
        "com.apple.UserNotificationCenter",
        "com.apple.controlcenter",
        "com.apple.notificationcenterui",
        "com.apple.Spotlight",
    ]

    public let ownBundleId: String
    public let allowlist: Set<String>

    public init(ownBundleId: String, allowlist: Set<String> = []) {
        self.ownBundleId = ownBundleId
        self.allowlist = allowlist
    }

    public func protects(_ bundleId: String) -> Bool {
        bundleId == ownBundleId || Self.neededToLeave.contains(bundleId) || allowlist.contains(bundleId)
    }
}
