// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiCore

/// `ApplicationActivationSource` on `NSWorkspace.didLaunchApplicationNotification`:
/// app blocking also decides on launch, before the first activation arrives.
@MainActor
public final class WorkspaceApplicationLaunchSource: ApplicationActivationSource {
    private var observer: (any NSObjectProtocol)?

    public init() {}

    public var frontmostApplication: ActivatedApplication? { nil }

    public func start(_ handler: @escaping @MainActor @Sendable (ActivatedApplication) -> Void) {
        stop()
        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didLaunchApplicationNotification, object: nil, queue: .main
        ) { notification in
            guard let running = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            else { return }
            let launched = ActivatedApplication(
                app: ForegroundApp(bundleIdentifier: running.bundleIdentifier, localizedName: running.localizedName),
                processIdentifier: running.processIdentifier
            )
            MainActor.assumeIsolated { handler(launched) }
        }
    }

    public func stop() {
        if let observer {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
        }
        observer = nil
    }
}
