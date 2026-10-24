// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// The wall clock, always injected. Domain code never calls `Date()`: it
/// receives a `Clock` (or the instant itself) so tests pin the time and the
/// decision logic stays deterministic. The platform adapter is
/// `SystemClock` in MonkiPlatform; tests use `FixedClock` from MonkiCoreTesting.
///
/// This protocol shadows the standard library's `Swift.Clock` for importers
/// of MonkiCore; spell the standard one `Swift.Clock` if it is ever needed.
public protocol Clock: Sendable {
    /// The current wall-clock instant. May jump when the user changes the time.
    func now() -> Date
}
