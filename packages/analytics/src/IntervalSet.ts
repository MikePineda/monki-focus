// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Half-open `[start, end)` intervals in epoch seconds (SEMANTICS.md §1) and
 * the set operations analytics needs: AFK cutting and browser dedupe.
 */
export interface Interval {
  start: number
  end: number
}

/** Sorted, disjoint, non-empty intervals covering the same time. Touching intervals merge. */
export function unionIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .map((interval) => ({ start: interval.start, end: interval.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: Interval[] = []
  for (const interval of sorted) {
    const last = merged.at(-1)
    if (last !== undefined && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      merged.push(interval)
    }
  }
  return merged
}

/**
 * The time of `minuend` not covered by `subtrahend`, as sorted, disjoint,
 * non-empty intervals.
 */
export function subtractIntervals(
  minuend: readonly Interval[],
  subtrahend: readonly Interval[]
): Interval[] {
  const holes = unionIntervals(subtrahend)
  const result: Interval[] = []
  for (const interval of unionIntervals(minuend)) {
    let cursor = interval.start
    for (const hole of holes) {
      if (hole.end <= cursor) continue
      if (hole.start >= interval.end) break
      if (hole.start > cursor) result.push({ start: cursor, end: hole.start })
      cursor = hole.end
    }
    if (cursor < interval.end) result.push({ start: cursor, end: interval.end })
  }
  return result
}
