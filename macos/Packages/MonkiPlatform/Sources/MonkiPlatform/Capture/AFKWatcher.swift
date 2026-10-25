// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Polls the idle time every `pollInterval` (5 s) and runs `AfkDetector`
/// (180 s threshold). Sleep, display sleep, lock, another session in front
/// and power off, delivered through `handle(_:)`, force AFK at once; wake or
/// unlock lets the idle time decide again.
///
/// `onObservation` gets every status with the instant it holds at.
@MainActor
public final class AFKWatcher {
    private let idle: any IdleTimeSource
    private let timers: any RepeatingTimerScheduler
    private let clock: CaptureClock
    private let pollInterval: Duration
    private let onObservation: @MainActor (AfkObservation) -> Void
    private var detector: AfkDetector
    private var timer: (any RepeatingTimer)?

    public init(
        idle: any IdleTimeSource,
        timers: any RepeatingTimerScheduler,
        clock: CaptureClock,
        pollInterval: Duration = .seconds(CaptureTiming.afkPollSeconds),
        thresholdSeconds: Int = CaptureTiming.afkThresholdSeconds,
        onObservation: @escaping @MainActor (AfkObservation) -> Void
    ) {
        self.idle = idle
        self.timers = timers
        self.clock = clock
        self.pollInterval = pollInterval
        self.detector = AfkDetector(thresholdSeconds: thresholdSeconds)
        self.onObservation = onObservation
    }

    /// The last status observed, nil before `start()`.
    public var status: AfkStatus? {
        detector.status
    }

    /// Whether sleep, lock or another session holds the user away.
    public var isForcedAway: Bool {
        detector.isForcedAway
    }

    public func start() {
        guard timer == nil else { return }
        poll()
        timer = timers.schedule(every: pollInterval) { [weak self] in
            self?.poll()
        }
    }

    public func stop() {
        timer?.cancel()
        timer = nil
    }

    /// A power or session notification.
    public func handle(_ event: SessionEvent) {
        guard timer != nil else { return }
        let now = clock.now()
        onObservation(detector.handle(event, secondsSinceInput: idle.secondsSinceLastInput(), at: now))
    }

    private func poll() {
        let now = clock.now()
        onObservation(detector.sample(secondsSinceInput: idle.secondsSinceLastInput(), at: now))
    }
}
