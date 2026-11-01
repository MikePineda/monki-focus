// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Whole epoch seconds of the injected wall clock, as the engine reads instants.
enum WallSeconds {
    static func of(_ wall: any MonkiCore.Clock) -> Int {
        Int(wall.now().timeIntervalSince1970.rounded(.down))
    }
}
