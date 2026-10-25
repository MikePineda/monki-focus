// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// The capture timeline (`CaptureTimeline`) read from the injected wall and
/// monotonic clocks. Every watcher stamps its observations with `now()`, so
/// all buckets share one timeline that never goes backwards.
@MainActor
public final class CaptureClock {
    private let wall: any MonkiCore.Clock
    private let monotonic: any MonotonicClock
    private var timeline: CaptureTimeline

    /// Called when the wall clock jumped forward: capture stops at the first
    /// instant and resumes at the second. Set by `ActivityCapture`.
    public var onInterruption: (@MainActor (_ stop: Int, _ resume: Int) -> Void)?

    public init(wall: any MonkiCore.Clock, monotonic: any MonotonicClock, floor: Int? = nil) {
        self.wall = wall
        self.monotonic = monotonic
        self.timeline = CaptureTimeline(floor: floor)
    }

    /// The current instant in whole epoch seconds.
    public func now() -> Int {
        let reading = timeline.read(wall: wall.now(), monotonic: monotonic.elapsed())
        if let stop = reading.interruptedAt {
            onInterruption?(stop, reading.instant)
        }
        return reading.instant
    }
}
