// SPDX-License-Identifier: AGPL-3.0-or-later

/// A half-open `[start, end)` interval in epoch seconds (SEMANTICS.md §1).
public struct Interval: Hashable, Sendable {
    public var start: Int
    public var end: Int

    public init(start: Int, end: Int) {
        self.start = start
        self.end = end
    }
}

/// Sorted, disjoint, non-empty intervals covering the same time. Touching intervals merge.
public func unionIntervals(_ intervals: [Interval]) -> [Interval] {
    let sorted = intervals.filter { $0.end > $0.start }
        .sorted { $0.start != $1.start ? $0.start < $1.start : $0.end < $1.end }
    var merged: [Interval] = []
    for interval in sorted {
        if let last = merged.last, interval.start <= last.end {
            merged[merged.count - 1].end = max(last.end, interval.end)
        } else {
            merged.append(interval)
        }
    }
    return merged
}

/// The time of `minuend` not covered by `subtrahend`, as sorted, disjoint,
/// non-empty intervals (AFK cutting and browser dedupe).
public func subtractIntervals(_ minuend: [Interval], _ subtrahend: [Interval]) -> [Interval] {
    let holes = unionIntervals(subtrahend)
    var result: [Interval] = []
    for interval in unionIntervals(minuend) {
        var cursor = interval.start
        for hole in holes {
            if hole.end <= cursor { continue }
            if hole.start >= interval.end { break }
            if hole.start > cursor { result.append(Interval(start: cursor, end: hole.start)) }
            cursor = hole.end
        }
        if cursor < interval.end { result.append(Interval(start: cursor, end: interval.end)) }
    }
    return result
}
