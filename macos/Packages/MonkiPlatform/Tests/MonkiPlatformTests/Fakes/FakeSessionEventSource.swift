// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// Session notifications sent by the test.
@MainActor
final class FakeSessionEventSource: SessionEventSource {
    private var handler: (@MainActor @Sendable (SessionEvent) -> Void)?

    var isStarted: Bool { handler != nil }

    func start(_ handler: @escaping @MainActor @Sendable (SessionEvent) -> Void) {
        self.handler = handler
    }

    func stop() {
        handler = nil
    }

    func send(_ event: SessionEvent) {
        handler?(event)
    }
}
