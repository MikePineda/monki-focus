// SPDX-License-Identifier: AGPL-3.0-or-later

/// What the window watcher records about the frontmost window.
public enum WindowTitleMode: Hashable, Sendable {
    /// The app only (bundle id and name). The default.
    case appOnly
    /// The app and its focused window title.
    case appAndTitle

    /// Titles are read only when the user turned them on (off by default)
    /// and granted Accessibility; anything less records the app only.
    public static func resolve(titlesEnabled: Bool, accessibilityTrusted: Bool) -> WindowTitleMode {
        titlesEnabled && accessibilityTrusted ? .appAndTitle : .appOnly
    }
}
