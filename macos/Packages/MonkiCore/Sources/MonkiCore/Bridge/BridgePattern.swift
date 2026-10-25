// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// An anchored schema pattern. The whole string must match: ICU's `$` would
/// also match before a final line feed, which JSON Schema's does not.
struct BridgePattern: Sendable {
    private let expression: NSRegularExpression

    init(_ pattern: String) {
        do {
            expression = try NSRegularExpression(pattern: pattern)
        } catch {
            // Every pattern is a constant of this module, covered by the fixture tests.
            preconditionFailure("invalid bridge pattern")
        }
    }

    func matches(_ text: String) -> Bool {
        let range = NSRange(text.startIndex..., in: text)
        return expression.firstMatch(in: text, range: range)?.range == range
    }

    static let utcInstant = BridgePattern(#"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$"#)
    static let version = BridgePattern(#"^[0-9]{1,9}(\.[0-9]{1,9}){0,3}$"#)
}
