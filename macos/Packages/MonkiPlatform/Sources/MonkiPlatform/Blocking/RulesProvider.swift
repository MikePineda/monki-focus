// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// The rule set and catalog app blocking and bedtime decide with. Nil when
/// the user has set no rules on this Mac: nothing is hidden or dimmed.
@MainActor
public protocol RulesProvider: AnyObject {
    var current: RulesSnapshot? { get }
}
