// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// One rule set with the catalog `decide` reads it with.
public struct RulesSnapshot: Hashable, Sendable {
    public var ruleset: Ruleset
    public var catalog: RulesCatalog

    public init(ruleset: Ruleset, catalog: RulesCatalog) {
        self.ruleset = ruleset
        self.catalog = catalog
    }
}
