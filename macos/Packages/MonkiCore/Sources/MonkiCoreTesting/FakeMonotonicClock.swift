// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

/// A monotonic clock that moves only when the test advances it.
public final class FakeMonotonicClock: MonotonicClock, @unchecked Sendable {
    private let lock = NSLock()
    private var reading: Duration

    public init(start: Duration = .zero) {
        reading = start
    }

    public func elapsed() -> Duration {
        lock.withLock { reading }
    }

    /// Moves the clock forward; a negative step is a test bug and traps.
    public func advance(by step: Duration) {
        precondition(step >= .zero, "a monotonic clock never goes backwards")
        lock.withLock { reading += step }
    }
}
