// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiPlatform
import os

/// Starts activity capture at launch and flushes it at quit. Capture is
/// local only: events stay in the user's Application Support folder.
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private static let logger = Logger(subsystem: "dev.monkifocus.mac", category: "app")

    private(set) var capture: ActivityCapture?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // The app also hosts its unit tests; those must not write the
        // user's activity database.
        guard ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil else { return }
        do {
            let database = try ActivityDatabase.open(at: ActivityDatabase.defaultURL())
            let identity = DeviceIdentity.current()
            let capture = try ActivityCapture(
                ActivityCapture.Dependencies(
                    sessions: WorkspaceSessionEventSource(),
                    activations: WorkspaceApplicationActivationSource(),
                    titles: AXFocusedWindowTitleSource(),
                    accessibility: SystemAccessibilityTrust(),
                    titleSetting: UserDefaultsWindowTitleSetting(),
                    idle: CombinedSessionIdleTimeSource(),
                    timers: MainRunLoopTimerScheduler(),
                    store: GRDBEventStore(database: database),
                    appNames: AppNameStore(database: database),
                    wall: SystemClock(),
                    monotonic: SystemMonotonicClock(),
                    hostname: identity.hostname,
                    deviceId: identity.deviceId
                ))
            capture.start()
            self.capture = capture
        } catch {
            Self.logger.error(
                "activity capture did not start: \(String(describing: type(of: error)), privacy: .public)")
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        capture?.stop()
    }
}
