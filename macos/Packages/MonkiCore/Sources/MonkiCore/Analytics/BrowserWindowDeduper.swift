// SPDX-License-Identifier: AGPL-3.0-or-later

// Browser dedupe on one device (SEMANTICS.md §10.8, macOS aggregator). Web
// events become `web` segments with their domain, never clipped to browser
// window time; other window events stay `app` segments. Browser window time
// minus the union of web events is uncovered. The extension's known
// heartbeats are the end of every web event and `extensionLastHeartbeatAt`;
// an uncovered instant `t` is `browser-unknown` when the latest heartbeat
// `h ≤ t` has `t < h + staleAfterSeconds`, otherwise (a silent extension, or
// no heartbeat yet) it counts as the browser app itself.

/// Activity key of browser time the live extension did not explain.
public let browserUnknown = "browser-unknown"

private struct Piece {
    var start: Int
    var end: Int
    let source: ActivitySource
    let activityKey: String

    /// Negative when `lhs` sorts first: start, end, source, activity key.
    static func compare(_ lhs: Piece, _ rhs: Piece) -> Int {
        if lhs.start != rhs.start { return lhs.start < rhs.start ? -1 : 1 }
        if lhs.end != rhs.end { return lhs.end < rhs.end ? -1 : 1 }
        let source = CodeUnitOrder.compare(lhs.source.rawValue, rhs.source.rawValue)
        return source != 0 ? source : CodeUnitOrder.compare(lhs.activityKey, rhs.activityKey)
    }
}

/// Splits an uncovered stretch where its latest heartbeat or its staleness
/// changes, labels each part, and joins neighbours with the same label.
private func attributeGap(_ gap: Interval, app: String, heartbeats: [Int], staleAfterSeconds: Int) -> [Piece] {
    let cuts = heartbeats.flatMap { [$0, $0 + staleAfterSeconds] }.filter { $0 > gap.start && $0 < gap.end }
    let ends = Set(cuts + [gap.end]).sorted()
    var pieces: [Piece] = []
    var start = gap.start
    for end in ends {
        // Heartbeats are sorted, so the last one at or before `start` is the latest.
        let latest = heartbeats.last { $0 <= start }
        let live = latest.map { start < $0 + staleAfterSeconds } ?? false
        let activityKey = live ? browserUnknown : app
        if let last = pieces.last, last.activityKey == activityKey {
            pieces[pieces.count - 1].end = end
        } else {
            pieces.append(Piece(start: start, end: end, source: .app, activityKey: activityKey))
        }
        start = end
    }
    return pieces
}

public func dedupeBrowserTime(_ input: BrowserDedupeInput) throws(EngineError) -> [AttributedSegment] {
    let browsers = Set(input.browserApps)
    var covered: [Piece] = []
    for event in input.webEvents {
        guard case .webTab(let tab) = event.data else { continue }
        let interval = try event.interval()
        covered.append(Piece(start: interval.start, end: interval.end, source: .web, activityKey: tab.domain))
    }
    let coveredIntervals = covered.map { Interval(start: $0.start, end: $0.end) }
    var heartbeats = covered.map(\.end)
    if let last = input.extensionLastHeartbeatAt { heartbeats.append(try epochSecondsOf(last)) }
    heartbeats.sort()

    var pieces = covered
    for event in input.windowEvents {
        guard case .window(let window) = event.data else { continue }
        let interval = try event.interval()
        guard browsers.contains(window.app) else {
            pieces.append(Piece(start: interval.start, end: interval.end, source: .app, activityKey: window.app))
            continue
        }
        for gap in subtractIntervals([interval], coveredIntervals) {
            pieces += attributeGap(
                gap, app: window.app, heartbeats: heartbeats, staleAfterSeconds: input.staleAfterSeconds)
        }
    }
    return pieces.filter { $0.end > $0.start }
        .enumerated()
        .sorted { lhs, rhs in
            let order = Piece.compare(lhs.element, rhs.element)
            return order != 0 ? order < 0 : lhs.offset < rhs.offset
        }
        .map {
            AttributedSegment(
                start: utcInstantOf($0.element.start),
                end: utcInstantOf($0.element.end),
                source: $0.element.source,
                activityKey: $0.element.activityKey
            )
        }
}
