// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiCore

/// `SessionEventSource` on `NSWorkspace`'s notification center (sleep,
/// wake, display sleep, session switching, power off) and the distributed
/// `com.apple.screenIsLocked` / `com.apple.screenIsUnlocked` notifications,
/// which macOS has posted on every lock and unlock since 10.x (there is no
/// public `NSWorkspace` notification for the lock itself).
@MainActor
public final class WorkspaceSessionEventSource: SessionEventSource {
    private static let screenLocked = Notification.Name("com.apple.screenIsLocked")
    private static let screenUnlocked = Notification.Name("com.apple.screenIsUnlocked")

    private var observers: [(NotificationCenter, any NSObjectProtocol)] = []

    public init() {}

    public func start(_ handler: @escaping @MainActor @Sendable (SessionEvent) -> Void) {
        stop()
        let workspace = NSWorkspace.shared.notificationCenter
        let distributed = DistributedNotificationCenter.default()
        let subscriptions: [(NotificationCenter, Notification.Name, SessionEvent)] = [
            (workspace, NSWorkspace.willSleepNotification, .systemWillSleep),
            (workspace, NSWorkspace.didWakeNotification, .systemDidWake),
            (workspace, NSWorkspace.screensDidSleepNotification, .screensDidSleep),
            (workspace, NSWorkspace.screensDidWakeNotification, .screensDidWake),
            (workspace, NSWorkspace.sessionDidResignActiveNotification, .sessionDidResignActive),
            (workspace, NSWorkspace.sessionDidBecomeActiveNotification, .sessionDidBecomeActive),
            (workspace, NSWorkspace.willPowerOffNotification, .systemWillPowerOff),
            (distributed, Self.screenLocked, .screenLocked),
            (distributed, Self.screenUnlocked, .screenUnlocked),
        ]
        for (center, name, event) in subscriptions {
            let observer = center.addObserver(forName: name, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated { handler(event) }
            }
            observers.append((center, observer))
        }
    }

    public func stop() {
        for (center, observer) in observers {
            center.removeObserver(observer)
        }
        observers.removeAll()
    }
}
