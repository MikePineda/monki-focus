// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// One reading of the capture timeline.
public struct CaptureReading: Hashable, Sendable {
    /// Whole epoch seconds; never earlier than any previous reading.
    public var instant: Int
    /// When the wall clock jumped forward since the previous reading: the
    /// instant the monotonic clock predicted, where continuous capture
    /// stops before it resumes at `instant`. Nil otherwise.
    public var interruptedAt: Int?

    public init(instant: Int, interruptedAt: Int? = nil) {
        self.instant = instant
        self.interruptedAt = interruptedAt
    }
}

/// Event timestamps that never go backwards, from an injected wall clock and
/// an injected monotonic clock (`trusted_now = max(wall, last + monotonic
/// elapsed)`, threat model §3).
///
/// - In sync (within the tolerance) it follows the wall clock.
/// - When the wall clock is set back, it keeps counting monotonic time from
///   the last good reading, so no event overlaps an earlier one.
/// - When the wall clock jumps forward, it follows the wall clock and
///   reports the jump, so the caller closes events at the predicted instant
///   instead of stretching them over time that never passed.
public struct CaptureTimeline: Sendable {
    public let toleranceSeconds: Int
    private var floorInstant: Int?
    private var anchor: (wall: Double, monotonic: Duration)?

    /// `floor` is the end of the latest stored event: a relaunch after the
    /// wall clock was set back never writes before it.
    public init(floor: Int? = nil, toleranceSeconds: Int = CaptureTiming.clockJumpToleranceSeconds) {
        self.floorInstant = floor
        self.toleranceSeconds = toleranceSeconds
    }

    public mutating func read(wall: Date, monotonic: Duration) -> CaptureReading {
        let reading = next(wall: wall.timeIntervalSince1970, monotonic: monotonic)
        floorInstant = reading.instant
        return reading
    }

    private mutating func next(wall wallSeconds: Double, monotonic: Duration) -> CaptureReading {
        guard let anchor else {
            self.anchor = (wallSeconds, monotonic)
            return CaptureReading(instant: atLeastFloor(wallSeconds))
        }
        let predicted = anchor.wall + Self.seconds(monotonic - anchor.monotonic)
        let tolerance = Double(toleranceSeconds)
        if wallSeconds > predicted + tolerance {
            self.anchor = (wallSeconds, monotonic)
            return CaptureReading(instant: atLeastFloor(wallSeconds), interruptedAt: atLeastFloor(predicted))
        }
        if wallSeconds < predicted - tolerance {
            return CaptureReading(instant: atLeastFloor(predicted))
        }
        self.anchor = (wallSeconds, monotonic)
        return CaptureReading(instant: atLeastFloor(wallSeconds))
    }

    private func atLeastFloor(_ seconds: Double) -> Int {
        max(Int(seconds.rounded(.down)), floorInstant ?? .min)
    }

    private static func seconds(_ duration: Duration) -> Double {
        let parts = duration.components
        return Double(parts.seconds) + Double(parts.attoseconds) / 1e18
    }
}
