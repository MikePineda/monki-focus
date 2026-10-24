// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

/// A wall clock pinned to an instant, moved only by `advance(by:)` or `set(_:)`.
/// The Swift counterpart of `Carbon::setTestNow`.
public final class FixedClock: MonkiCore.Clock, @unchecked Sendable {
    private let lock = NSLock()
    private var instant: Date

    public init(_ instant: Date) {
        self.instant = instant
    }

    public func now() -> Date {
        lock.withLock { instant }
    }

    public func advance(by seconds: TimeInterval) {
        lock.withLock { instant = instant.addingTimeInterval(seconds) }
    }

    public func set(_ newInstant: Date) {
        lock.withLock { instant = newInstant }
    }
}
