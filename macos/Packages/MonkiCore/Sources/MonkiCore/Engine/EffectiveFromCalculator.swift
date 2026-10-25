// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// When a waiting rule change takes effect (SEMANTICS.md §8):
//
// 1. the next local midnight after `now` (the later one across both zones
//    while a zone change waits);
// 2. the first instant at or after it that lies in no old window of a
//    waiting part (in either zone): the end of the union of the half-open
//    windows that chain from it, however many there are. This is a time
//    bound, never a round count: the result is never later than `now` +
//    8 days, and exactly that when the union still covers it (24-hour
//    windows on every day never end);
// 3. never earlier than the pending change's `effectiveFrom`.

/// Step 2 never pushes `effectiveFrom` more than 8 days after `now`.
let maxDeferralSeconds = 8 * 86_400

/// End instants of the windows active at `epochSeconds` in any of the zones.
private func activeWindowEnds(_ epochSeconds: Int, zones: [TimeZone], windows: [Schedule]) -> [Int] {
    zones.flatMap { zone in
        let local = localTimeAt(epochSeconds, zone)
        return windows.compactMap { window in
            window.occurrence(at: local).map { occurrence in
                let endMinute =
                    occurrence.startDayNumber * minutesPerDay + occurrence.startMinute + occurrence.lengthMinutes
                return firstInstantReachingWall(after: epochSeconds, wall: endMinute * 60, zone)
            }
        }
    }
}

func effectiveFromOf(nowSeconds: Int, zones: [TimeZone], windows: [Schedule], pendingSeconds: Int?) -> Int {
    let latest = nowSeconds + maxDeferralSeconds
    var instant = zones.map { nextLocalMidnight(nowSeconds, $0) }.max() ?? latest
    // Each step jumps to the end of a window covering `instant`, so it strictly advances.
    while instant < latest {
        guard let end = activeWindowEnds(instant, zones: zones, windows: windows).max() else { break }
        instant = end
    }
    let bounded = min(instant, latest)
    return pendingSeconds.map { max(bounded, $0) } ?? bounded
}
