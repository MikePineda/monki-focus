// SPDX-License-Identifier: AGPL-3.0-or-later

/// The frontmost application as the window watcher sees it.
public struct ForegroundApp: Hashable, Sendable {
    /// The activity key of an app that has neither a bundle id nor a name.
    public static let unidentifiedKey = "unidentified"

    public var bundleIdentifier: String?
    public var localizedName: String?

    public init(bundleIdentifier: String?, localizedName: String?) {
        self.bundleIdentifier = bundleIdentifier
        self.localizedName = localizedName
    }

    /// The `app` of a `currentwindow` event: the bundle id (the activity key
    /// categories match), else the localized name for the rare app without one.
    public var activityKey: String {
        Self.nonEmpty(bundleIdentifier) ?? Self.nonEmpty(localizedName) ?? Self.unidentifiedKey
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}
