// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Power and session notifications (sleep, wake, display sleep, lock,
/// fast user switching, power off). The real source is
/// `WorkspaceSessionEventSource`; tests drive a fake.
@MainActor
public protocol SessionEventSource: AnyObject {
    /// Delivers every event to `handler` on the main actor until `stop()`.
    func start(_ handler: @escaping @MainActor @Sendable (SessionEvent) -> Void)
    func stop()
}
