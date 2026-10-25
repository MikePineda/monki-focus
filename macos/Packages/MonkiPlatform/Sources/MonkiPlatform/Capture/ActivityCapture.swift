// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Wires the window and AFK watchers to the heartbeat queue and owns the
/// sleep and lock handling:
///
/// - Sleep, display sleep, lock, another session in front and power off
///   force AFK, end the current window event at that instant and flush
///   before the system goes on. Wake or unlock resumes both once no other
///   reason holds the user away.
/// - Turning AFK flushes; quitting (`stop()`) ends every event and flushes.
/// - Every 10 s the frontmost app is observed again and the batch is written.
///
/// Every platform dependency is behind a protocol, so the whole flow runs
/// in tests with fake notifications, a fake idle time and fake clocks.
@MainActor
public final class ActivityCapture {
    public struct Dependencies {
        public var sessions: any SessionEventSource
        public var activations: any ApplicationActivationSource
        public var titles: any FocusedWindowTitleSource
        public var accessibility: any AccessibilityTrust
        public var titleSetting: any WindowTitleSetting
        public var idle: any IdleTimeSource
        public var timers: any RepeatingTimerScheduler
        public var store: any EventStore
        public var appNames: AppNameStore?
        public var wall: any MonkiCore.Clock
        public var monotonic: any MonotonicClock
        public var hostname: String
        public var deviceId: String

        public init(
            sessions: any SessionEventSource, activations: any ApplicationActivationSource,
            titles: any FocusedWindowTitleSource, accessibility: any AccessibilityTrust,
            titleSetting: any WindowTitleSetting, idle: any IdleTimeSource, timers: any RepeatingTimerScheduler,
            store: any EventStore, appNames: AppNameStore?, wall: any MonkiCore.Clock,
            monotonic: any MonotonicClock, hostname: String, deviceId: String
        ) {
            self.sessions = sessions
            self.activations = activations
            self.titles = titles
            self.accessibility = accessibility
            self.titleSetting = titleSetting
            self.idle = idle
            self.timers = timers
            self.store = store
            self.appNames = appNames
            self.wall = wall
            self.monotonic = monotonic
            self.hostname = hostname
            self.deviceId = deviceId
        }
    }

    public let windowBucket: BucketDescriptor
    public let afkBucket: BucketDescriptor
    public let queue: HeartbeatQueue
    private let dependencies: Dependencies
    private let clock: CaptureClock
    private var window: WindowWatcher?
    private var afk: AFKWatcher?
    private var isRunning = false
    private var lastNamedApp: ForegroundApp?

    /// Registers the buckets (seeding them from the store); `start()` begins capture.
    public init(_ dependencies: Dependencies) throws {
        self.dependencies = dependencies
        let created = utcInstantOf(Int(dependencies.wall.now().timeIntervalSince1970.rounded(.down)))
        windowBucket = .mac(
            .currentWindow, hostname: dependencies.hostname, deviceId: dependencies.deviceId, created: created)
        afkBucket = .mac(.afkStatus, hostname: dependencies.hostname, deviceId: dependencies.deviceId, created: created)
        queue = HeartbeatQueue(store: dependencies.store)
        try queue.register(windowBucket)
        try queue.register(afkBucket)
        clock = CaptureClock(wall: dependencies.wall, monotonic: dependencies.monotonic, floor: queue.latestEnd)
    }

    public var isAway: Bool {
        afk?.isForcedAway ?? false
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        clock.onInterruption = { [weak self] stop, resume in
            self?.queue.interrupt(from: stop, to: resume)
        }
        let afk = AFKWatcher(idle: dependencies.idle, timers: dependencies.timers, clock: clock) { [weak self] in
            self?.afkObserved($0)
        }
        let window = WindowWatcher(
            activations: dependencies.activations, titles: dependencies.titles,
            accessibility: dependencies.accessibility, titleSetting: dependencies.titleSetting
        ) { [weak self] in
            self?.windowChanged()
        }
        self.afk = afk
        self.window = window
        afk.start()
        window.start()
        dependencies.sessions.start { [weak self] event in
            self?.handle(event)
        }
        queue.startPeriodicFlush(timers: dependencies.timers) { [weak self] in
            self?.windowChanged()
        }
    }

    /// Quit: every event ends now and the batch is written.
    public func stop() {
        guard isRunning else { return }
        isRunning = false
        dependencies.sessions.stop()
        queue.stopPeriodicFlush()
        afk?.stop()
        window?.stop()
        queue.stopAll(at: clock.now())
        queue.flush()
    }

    /// The title setting or the Accessibility grant changed.
    public func refreshTitleMode() {
        window?.refreshMode()
    }

    private func handle(_ event: SessionEvent) {
        guard isRunning, let afk, let window else { return }
        afk.handle(event)
        if afk.isForcedAway {
            window.suspend()
        } else {
            window.resume()
        }
        if event.requiresFlush {
            queue.flush()
        }
    }

    private func windowChanged() {
        guard let window else { return }
        let now = clock.now()
        queue.record(window.eventData, bucketId: windowBucket.id, at: now)
        if let app = window.snapshot?.app, window.eventData != nil, app != lastNamedApp {
            do {
                try dependencies.appNames?.remember(app, at: now)
                lastNamedApp = app
            } catch {
                CaptureLog.failure("app name write failed", error)
            }
        }
    }

    private func afkObserved(_ observation: AfkObservation) {
        queue.record(.afk(observation.status), bucketId: afkBucket.id, at: observation.at)
        if observation.isTransition, observation.status == .afk {
            queue.flush()
        }
    }
}
