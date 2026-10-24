// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

/// The real wall clock. Injected at the composition root; domain code only
/// sees `MonkiCore.Clock`.
public struct SystemClock: MonkiCore.Clock {
    public init() {}

    public func now() -> Date {
        Date()
    }
}
