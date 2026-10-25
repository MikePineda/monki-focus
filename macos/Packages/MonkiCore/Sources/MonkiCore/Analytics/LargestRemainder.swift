// SPDX-License-Identifier: AGPL-3.0-or-later

/// Something with a whole number of seconds that largest-remainder scaling can shrink.
protocol SecondsCarrying {
    var seconds: Int { get set }
}

/// Largest-remainder scaling (SEMANTICS.md §10.9, §13.10): when the seconds
/// add up to more than `cap`, each becomes `floor(s × cap / total)` and the
/// seconds left over go one each to the largest fractional parts, ties broken
/// by `tieOrder` (then input order). Exact integer arithmetic; the scaled
/// seconds sum to `cap`. At or under the cap every item keeps its seconds.
/// Items keep their order.
func scaleToCap<Item: SecondsCarrying>(_ items: [Item], cap: Int, tieOrder: (Item, Item) -> Int) -> [Item] {
    let total = items.reduce(0) { $0 + $1.seconds }
    guard total > cap else { return items }
    var scaled = items.map { $0.seconds * cap / total }
    // The fractional part, as a numerator over `total`.
    let remainders = items.map { $0.seconds * cap % total }
    let leftover = cap - scaled.reduce(0, +)
    let byRemainder = items.indices.sorted { lhs, rhs in
        if remainders[lhs] != remainders[rhs] { return remainders[lhs] > remainders[rhs] }
        let tie = tieOrder(items[lhs], items[rhs])
        return tie != 0 ? tie < 0 : lhs < rhs
    }
    for index in byRemainder.prefix(leftover) { scaled[index] += 1 }
    return zip(items, scaled).map { item, seconds in
        var copy = item
        copy.seconds = seconds
        return copy
    }
}
