// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// An idle time that grows with the fake clock until the test registers input.
@MainActor
final class FakeIdleTimeSource: IdleTimeSource {
    private let time: FakeTime
    private var lastInput: Int

    init(time: FakeTime) {
        self.time = time
        lastInput = time.now
    }

    /// The user touched the keyboard or mouse now.
    func input() {
        lastInput = time.now
    }

    nonisolated func secondsSinceLastInput() -> Double {
        MainActor.assumeIsolated { Double(time.now - lastInput) }
    }
}
