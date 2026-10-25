// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.analytics

/*
 * Largest-remainder scaling (SEMANTICS.md §10.9, §13.10): when the seconds
 * add up to more than `cap`, each becomes `floor(s × cap / total)` and the
 * seconds left over go one each to the largest fractional parts, ties broken
 * by `tieOrder` (then by position). Exact integer arithmetic; the scaled
 * seconds sum to `cap`. At or under the cap every item keeps its seconds.
 */

/** The scaled seconds of each item, in item order. */
fun <T> scaleToCap(
    items: List<T>,
    cap: Long,
    tieOrder: Comparator<in T>,
    secondsOf: (T) -> Long,
): List<Long> {
    val seconds = items.map(secondsOf)
    val total = seconds.sum()
    if (total <= cap) return seconds
    val scaled = seconds.map { Math.floorDiv(it * cap, total) }.toMutableList()
    // The fractional part, as a numerator over `total`.
    val remainders = seconds.map { Math.floorMod(it * cap, total) }
    val leftover = (cap - scaled.sum()).toInt()
    val byRemainder =
        items.indices.sortedWith(
            compareByDescending<Int> { remainders[it] }.then { a, b -> tieOrder.compare(items[a], items[b]) },
        )
    for (index in byRemainder.take(leftover)) scaled[index] += 1
    return scaled
}
