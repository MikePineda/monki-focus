// SPDX-License-Identifier: AGPL-3.0-or-later

/// What `toBlocks` needs besides the events.
public struct BlockOptions: Hashable, Sendable {
    public var deviceId: String
    /// Whether blocks carry the domain or app id (off: `activityKey` is nil).
    public var syncActivityKey: Bool

    public init(deviceId: String, syncActivityKey: Bool) {
        self.deviceId = deviceId
        self.syncActivityKey = syncActivityKey
    }
}

private struct BlockKey: Hashable {
    let blockStart: String
    let source: ActivitySource
    let activityKey: String?
    let categoryPath: String
    let level: Int
}

/// 5-minute blocks (SEMANTICS.md §10.6): each attributed event is cut at UTC
/// 5-minute boundaries and summed per `(blockStart, source, activityKey,
/// categoryPath, level)`. With `syncActivityKey` off the key is nil and keys
/// merge. One device's blocks never exceed 300 s per block start. Titles and
/// URLs known locally are never read.
public func toBlocks(_ events: [AttributedEvent], options: BlockOptions) throws -> [SyncBlock] {
    var order: [BlockKey] = []
    var sums: [BlockKey: BlockDraft] = [:]
    for event in events {
        let activityKey = options.syncActivityKey ? event.activityKey : nil
        var cursor = try epochSecondsOf(event.timestamp)
        let end = cursor + event.duration
        while cursor < end {
            let start = floorDivision(cursor, blockSeconds) * blockSeconds
            let pieceEnd = min(start + blockSeconds, end)
            let blockStart = utcInstantOf(start)
            let key = BlockKey(
                blockStart: blockStart,
                source: event.source,
                activityKey: activityKey,
                categoryPath: event.categoryPath,
                level: event.level
            )
            if sums[key] == nil {
                order.append(key)
                sums[key] = BlockDraft(
                    deviceId: options.deviceId,
                    blockStart: blockStart,
                    activityKey: activityKey,
                    categoryPath: event.categoryPath,
                    level: event.level,
                    source: event.source,
                    seconds: 0
                )
            }
            sums[key]?.seconds += pieceEnd - cursor
            cursor = pieceEnd
        }
    }
    return try capDrafts(order.compactMap { sums[$0] })
}
