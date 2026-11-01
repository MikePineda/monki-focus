// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiPlatform

/// The rule set app blocking and bedtime read on this Mac:
/// `~/Library/Application Support/monki-focus/rules.json`, read once at
/// launch. Until the Settings screens (M8) or the server sync write it,
/// a missing or unreadable file means no rules: nothing is hidden or dimmed.
@MainActor
final class StoredRulesProvider: RulesProvider {
    let current: RulesSnapshot?

    init(url: URL?) {
        guard let url, let data = try? Data(contentsOf: url),
            let ruleset = try? JSONDecoder().decode(Ruleset.self, from: data)
        else {
            current = nil
            return
        }
        current = RulesSnapshot(
            ruleset: ruleset, catalog: RulesCatalog(siteProfiles: [], surfaces: [], defaultCategories: []))
    }

    static func defaultURL() -> URL? {
        try? FileManager.default
            .url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
            .appending(path: "monki-focus/rules.json", directoryHint: .notDirectory)
    }
}
