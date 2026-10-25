// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Watches the frontmost app (`NSWorkspace.didActivateApplicationNotification`
/// through an `ApplicationActivationSource`) and, only when the user turned
/// window titles on **and** granted Accessibility, the focused window title
/// (AXObserver through a `FocusedWindowTitleSource`). Otherwise it records
/// the app alone and never touches Accessibility. No ScriptingBridge.
///
/// `onChange` fires whenever `eventData` changes; it is nil while capture is
/// suspended (sleep, lock, another session in front) or stopped.
@MainActor
public final class WindowWatcher {
    private let activations: any ApplicationActivationSource
    private let titles: any FocusedWindowTitleSource
    private let accessibility: any AccessibilityTrust
    private let titleSetting: any WindowTitleSetting
    private let onChange: @MainActor () -> Void

    public private(set) var mode: WindowTitleMode = .appOnly
    public private(set) var snapshot: WindowSnapshot?
    public private(set) var isSuspended = false
    private var isRunning = false
    private var frontmost: ActivatedApplication?

    public init(
        activations: any ApplicationActivationSource,
        titles: any FocusedWindowTitleSource,
        accessibility: any AccessibilityTrust,
        titleSetting: any WindowTitleSetting,
        onChange: @escaping @MainActor () -> Void
    ) {
        self.activations = activations
        self.titles = titles
        self.accessibility = accessibility
        self.titleSetting = titleSetting
        self.onChange = onChange
    }

    /// The `currentwindow` data to record now, nil while not capturing.
    public var eventData: EventData? {
        guard isRunning, !isSuspended else { return nil }
        return snapshot?.eventData(mode: mode)
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        activations.start { [weak self] application in
            self?.activated(application)
        }
        activated(activations.frontmostApplication)
    }

    public func stop() {
        guard isRunning else { return }
        activations.stop()
        titles.stopFollowing()
        isRunning = false
        snapshot = nil
        onChange()
    }

    /// Pauses capture (sleep, lock): the current event ends now.
    public func suspend() {
        guard isRunning, !isSuspended else { return }
        isSuspended = true
        titles.stopFollowing()
        onChange()
    }

    /// Resumes capture with whatever app is in front now.
    public func resume() {
        guard isRunning, isSuspended else { return }
        snapshot = nil
        isSuspended = false
        activated(activations.frontmostApplication)
    }

    /// Re-reads the title setting and the Accessibility grant (the user
    /// changed one of them) and applies the result to the frontmost app.
    public func refreshMode() {
        guard isRunning, !isSuspended else { return }
        activated(frontmost)
    }

    private func activated(_ application: ActivatedApplication?) {
        frontmost = application
        guard isRunning, !isSuspended else { return }
        let before = eventData
        mode = WindowTitleMode.resolve(
            titlesEnabled: titleSetting.titlesEnabled, accessibilityTrusted: accessibility.isTrusted())
        guard let application else {
            titles.stopFollowing()
            update(nil, since: before)
            return
        }
        update(WindowSnapshot(app: application.app), since: before)
        guard mode == .appAndTitle else {
            titles.stopFollowing()
            return
        }
        let processIdentifier = application.processIdentifier
        titles.follow(processIdentifier: processIdentifier) { [weak self] title in
            self?.titleChanged(title, processIdentifier: processIdentifier)
        }
    }

    private func titleChanged(_ title: String?, processIdentifier: Int32) {
        guard isRunning, !isSuspended, mode == .appAndTitle, let frontmost,
            frontmost.processIdentifier == processIdentifier
        else { return }
        update(WindowSnapshot(app: frontmost.app, title: title), since: eventData)
    }

    /// Sets the snapshot and reports a change of `eventData` from `before`.
    private func update(_ next: WindowSnapshot?, since before: EventData?) {
        snapshot = next
        if eventData != before {
            onChange()
        }
    }
}
