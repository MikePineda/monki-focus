// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiCore

/// `ApplicationActivationSource` on `NSWorkspace.didActivateApplicationNotification`.
@MainActor
public final class WorkspaceApplicationActivationSource: ApplicationActivationSource {
    private var observer: (any NSObjectProtocol)?

    public init() {}

    public var frontmostApplication: ActivatedApplication? {
        NSWorkspace.shared.frontmostApplication.map(Self.activated)
    }

    public func start(_ handler: @escaping @MainActor @Sendable (ActivatedApplication) -> Void) {
        stop()
        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
        ) { notification in
            let running = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            guard let application = running.map(Self.activated) else { return }
            MainActor.assumeIsolated { handler(application) }
        }
    }

    public func stop() {
        if let observer {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
        }
        observer = nil
    }

    private nonisolated static func activated(_ running: NSRunningApplication) -> ActivatedApplication {
        ActivatedApplication(
            app: ForegroundApp(bundleIdentifier: running.bundleIdentifier, localizedName: running.localizedName),
            processIdentifier: running.processIdentifier
        )
    }
}
