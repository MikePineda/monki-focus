// SPDX-License-Identifier: AGPL-3.0-or-later

/// The 300-second cap on one block start (SEMANTICS.md §10.9, server side,
/// and §10.6, one device): per `blockStart`, blocks adding up to more than
/// 300 s are scaled by largest remainder, ties by `deviceId`, `activityKey`,
/// `categoryPath` (then `source`, `level`); blocks that reach 0 are dropped.
/// Output in canonical block order.
public func capAcrossDevices(_ blocks: [SyncBlock]) throws(AnalyticsError) -> [SyncBlock] {
    try capDrafts(blocks.map(BlockDraft.init))
}

/// `capAcrossDevices` for drafts whose seconds may still exceed the cap.
func capDrafts(_ drafts: [BlockDraft]) throws(AnalyticsError) -> [SyncBlock] {
    var starts: [String] = []
    var groups: [String: [BlockDraft]] = [:]
    for draft in drafts {
        if groups[draft.blockStart] == nil { starts.append(draft.blockStart) }
        groups[draft.blockStart, default: []].append(draft)
    }
    let capped = starts.flatMap { start in
        scaleToCap(groups[start] ?? [], cap: blockSeconds, tieOrder: BlockDraft.compare)
    }
    .filter { $0.seconds > 0 }
    var blocks: [SyncBlock] = []
    for draft in capped { blocks.append(try draft.syncBlock()) }
    // Stable: blocks with equal keys keep their input order.
    return blocks.enumerated()
        .sorted { lhs, rhs in
            let order = SyncBlock.compare(lhs.element, rhs.element)
            return order != 0 ? order < 0 : lhs.offset < rhs.offset
        }
        .map(\.element)
}
