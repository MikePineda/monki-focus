// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiPlatform
import Testing

/// The system adapters are the only place that reads the real time.
@Suite("System clocks")
struct SystemClockTests {
    @Test("the system clock reads the current wall time")
    func theSystemClockReadsTheCurrentWallTime() {
        let clock: any MonkiCore.Clock = SystemClock()

        let before = Date()
        let reading = clock.now()
        let after = Date()

        #expect(before <= reading && reading <= after)
    }

    @Test("the system monotonic clock never goes backwards")
    func theSystemMonotonicClockNeverGoesBackwards() {
        let monotonic: any MonotonicClock = SystemMonotonicClock()

        let first = monotonic.elapsed()
        let second = monotonic.elapsed()

        #expect(first > .zero)
        #expect(second >= first)
    }
}
