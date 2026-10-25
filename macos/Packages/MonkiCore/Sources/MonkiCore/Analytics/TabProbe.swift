// SPDX-License-Identifier: AGPL-3.0-or-later

/// Browser tab sampling (SEMANTICS.md §10.2). The adapter reads the browser
/// state; this function decides whether it is a heartbeat and what it holds:
/// a zero-length heartbeat at `now`, or nil when nothing must be counted. The
/// URL goes through the engine's `normalizeUrl` (§2): never the query or the
/// fragment; the title only when the user opted in.
public func probeTab(_ input: TabProbeInput, catalog: RulesCatalog) throws(EngineError) -> ActivityEvent? {
    guard input.windowFocused, input.idleState != .locked, let tab = input.tab else { return nil }
    let countsWhileIdle = tab.audible && input.settings.countAudibleWhileIdle
    if input.idleState == .idle && !countsWhileIdle { return nil }

    guard case .normalized(let host, let path, _, let surface) = normalizeUrl(tab.url, catalog: catalog) else {
        return nil
    }
    let data = WebTabData(
        domain: host,
        path: path,
        surface: surface,
        audible: tab.audible,
        incognito: tab.incognito,
        title: input.settings.storeTitles ? tab.title : nil
    )
    return ActivityEvent(timestamp: utcInstantOf(try epochSecondsOf(input.now)), duration: 0, data: .webTab(data))
}
