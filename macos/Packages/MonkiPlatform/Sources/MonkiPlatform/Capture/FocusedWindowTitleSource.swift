// SPDX-License-Identifier: AGPL-3.0-or-later

/// The title of an application's focused window and its changes
/// (`AXFocusedWindowTitleSource`). Only used when the user turned window
/// titles on and granted Accessibility.
@MainActor
public protocol FocusedWindowTitleSource: AnyObject {
    /// Follows `processIdentifier`'s focused window, replacing any previous
    /// application: `handler` gets the current title at once, then every
    /// change (nil when no title can be read).
    func follow(processIdentifier: Int32, _ handler: @escaping @MainActor @Sendable (String?) -> Void)

    /// Stops following; no handler is called afterwards.
    func stopFollowing()
}
