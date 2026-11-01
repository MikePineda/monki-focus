// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit

/// `ApplicationControl` on `NSRunningApplication`: `hide()` and `activate()` only.
@MainActor
public final class WorkspaceApplicationControl: ApplicationControl {
    public init() {}

    public func hide(processIdentifier: Int32) {
        NSRunningApplication(processIdentifier: processIdentifier)?.hide()
    }

    public func activate(processIdentifier: Int32) {
        guard let application = NSRunningApplication(processIdentifier: processIdentifier) else { return }
        application.unhide()
        application.activate()
    }
}
