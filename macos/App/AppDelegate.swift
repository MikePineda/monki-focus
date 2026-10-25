// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiCore
import MonkiPlatform
import os

/// Starts activity capture and the browser bridge at launch, and flushes and
/// closes them at quit. Capture is local only: events stay in the user's
/// Application Support folder.
///
/// The bridge socket serves `monki-bridge`, the extension's native messaging
/// host. The host manifest is (re)written at launch only when extension ids
/// are configured (`defaults write dev.monkifocus.mac bridge.extensionIds
/// -array <id>`); the onboarding's "Install connector" step takes over later.
@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private static let logger = Logger(subsystem: "dev.monkifocus.mac", category: "app")
    private static let extensionIdsKey = "bridge.extensionIds"

    private(set) var capture: ActivityCapture?
    private var bridge: BridgeSocketServer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // The app also hosts its unit tests; those must not write the
        // user's activity database or serve the user's bridge socket.
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
            startBridge(queue: capture.queue, identity: identity)
        } catch {
            Self.logger.error(
                "activity capture did not start: \(String(describing: type(of: error)), privacy: .public)")
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        bridge?.stop()
        capture?.stop()
    }

    private func startBridge(queue: HeartbeatQueue, identity: DeviceIdentity) {
        let recorder = BrowserActivityRecorder(
            queue: queue, hostname: identity.hostname, deviceId: identity.deviceId, wall: SystemClock())
        let handler = AppBridgeHandler(appVersion: Self.appVersion) { heartbeat, browser in
            Task { @MainActor in recorder.record(heartbeat, from: browser) }
        }
        do {
            let server = BridgeSocketServer(
                configuration: .init(socketPath: try BridgeSocketServer.defaultSocketPath()), handler: handler)
            try server.start()
            bridge = server
        } catch {
            Self.logger.error("bridge did not start: \(String(describing: type(of: error)), privacy: .public)")
        }
        refreshHostManifest()
    }

    /// Points the browsers' host manifest at this copy of the helper, when ids are configured.
    private func refreshHostManifest() {
        let ids = UserDefaults.standard.stringArray(forKey: Self.extensionIdsKey) ?? []
        guard !ids.isEmpty else { return }
        let helper = Bundle.main.bundleURL.appending(path: "Contents/Helpers/monki-bridge")
        do {
            try NativeHostManifestInstaller().install(NativeHostManifest(helperPath: helper.path, extensionIds: ids))
        } catch {
            Self.logger.error("host manifest not written: \(String(describing: type(of: error)), privacy: .public)")
        }
    }

    /// `CFBundleShortVersionString` when it is a plain dotted version, else 0.0.0.
    private static var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
        let parts = version.split(separator: ".", omittingEmptySubsequences: false)
        let plain =
            (1...4).contains(parts.count)
            && parts.allSatisfy { part in !part.isEmpty && part.utf8.allSatisfy { (48...57).contains($0) } }
        return plain ? version : "0.0.0"
    }
}
