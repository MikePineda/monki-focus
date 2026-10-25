// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiPlatform
import os

/// Answers like the app (`AppBridgeHandler`) and records every message it was given.
final class RecordingBridgeHandler: BridgeMessageHandler {
    private let inner = AppBridgeHandler(appVersion: "0.1.0", activity: { _, _ in })
    private let log = OSAllocatedUnfairLock(initialState: [BridgeMessage]())

    var messages: [BridgeMessage] {
        log.withLock { $0 }
    }

    func handle(_ message: BridgeMessage, session: inout BridgeSession) -> [BridgeMessage] {
        log.withLock { $0.append(message) }
        return inner.handle(message, session: &session)
    }
}
