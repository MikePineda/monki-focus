// SPDX-License-Identifier: AGPL-3.0-or-later

/// String order is code-unit order (SEMANTICS.md §1), as JavaScript's default
/// `sort()` and `<` compare strings: UTF-16 code units, not Swift's
/// canonical-equivalence order. Rule ids are ASCII by schema, so every
/// platform sorts them identically.
enum CodeUnitOrder {
    static func less(_ lhs: String, _ rhs: String) -> Bool {
        lhs.utf16.lexicographicallyPrecedes(rhs.utf16)
    }

    /// Negative, zero or positive like a JavaScript comparator.
    static func compare(_ lhs: String, _ rhs: String) -> Int {
        if less(lhs, rhs) { return -1 }
        return less(rhs, lhs) ? 1 : 0
    }

    /// `compare` where `nil` sorts before every string.
    static func compareNullable(_ lhs: String?, _ rhs: String?) -> Int {
        switch (lhs, rhs) {
        case (nil, nil): 0
        case (nil, _): -1
        case (_, nil): 1
        case (let lhs?, let rhs?): compare(lhs, rhs)
        }
    }
}
