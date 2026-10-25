// SPDX-License-Identifier: AGPL-3.0-or-later

/// The frontmost application and its changes
/// (`NSWorkspace.didActivateApplicationNotification` in
/// `WorkspaceApplicationActivationSource`).
@MainActor
public protocol ApplicationActivationSource: AnyObject {
    /// The application in front right now, if any.
    var frontmostApplication: ActivatedApplication? { get }

    /// Delivers every activation to `handler` on the main actor until `stop()`.
    func start(_ handler: @escaping @MainActor @Sendable (ActivatedApplication) -> Void)
    func stop()
}
