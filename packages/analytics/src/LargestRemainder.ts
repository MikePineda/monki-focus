// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Largest-remainder scaling (SEMANTICS.md §10.9, §13.10): when the seconds
 * add up to more than `cap`, each becomes `floor(s × cap / total)` and the
 * seconds left over go one each to the largest fractional parts, ties broken
 * by `tieOrder`. Exact integer arithmetic; the scaled seconds sum to `cap`.
 * At or under the cap every item keeps its seconds. Items keep their order.
 */
export function scaleToCap<T extends { seconds: number }>(
  items: readonly T[],
  cap: number,
  tieOrder: (a: T, b: T) => number
): T[] {
  const total = items.reduce((sum, item) => sum + item.seconds, 0)
  if (total <= cap) return items.map((item) => ({ ...item }))
  const parts = items.map((item) => ({
    item,
    scaled: Math.floor((item.seconds * cap) / total),
    // The fractional part, as a numerator over `total`.
    remainder: (item.seconds * cap) % total,
  }))
  const leftover = cap - parts.reduce((sum, part) => sum + part.scaled, 0)
  const byRemainder = [...parts].sort(
    (a, b) => b.remainder - a.remainder || tieOrder(a.item, b.item)
  )
  for (const part of byRemainder.slice(0, leftover)) part.scaled += 1
  return parts.map((part) => ({ ...part.item, seconds: part.scaled }))
}
