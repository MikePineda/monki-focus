// SPDX-License-Identifier: AGPL-3.0-or-later

/// Seconds in a block, and the cap on one block start (SEMANTICS.md §10.6).
public let blockSeconds = 300

/// The productivity levels a category can have (0 = very distracting).
let categoryLevels = [0, 25, 50, 75, 100]

/// The only analytics record that leaves a device (SEMANTICS.md §10.6,
/// `activity.schema.json#/$defs/block`): a 5-minute block with exactly seven
/// fields. It never carries a title, a URL or a path; `activityKey` is a
/// normalised domain or an app id, or nil when the user turned key sync off.
/// The initialiser is the single door every block goes through (decoding
/// included): it rejects values that do not fit the schema (a URL passed as a
/// key, an unaligned start, seconds out of `1...300`).
public struct SyncBlock: Hashable, Sendable, Codable {
    public let deviceId: String
    public let blockStart: String
    public let activityKey: String?
    public let categoryPath: String
    public let level: Int
    public let source: ActivitySource
    public let seconds: Int

    /// The seven synced fields, in schema order.
    public static let fields = CodingKeys.allCases.map(\.stringValue)

    public init(
        deviceId: String,
        blockStart: String,
        activityKey: String?,
        categoryPath: String,
        level: Int,
        source: ActivitySource,
        seconds: Int
    ) throws(AnalyticsError) {
        guard deviceId.wholeMatch(of: /[A-Za-z0-9_-]{1,64}/) != nil else { throw .invalidSyncBlock("deviceId") }
        guard blockStart.wholeMatch(of: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]:00Z/) != nil else {
            throw .invalidSyncBlock("blockStart")
        }
        if let activityKey, activityKey.wholeMatch(of: /[A-Za-z0-9][A-Za-z0-9._-]{0,254}/) == nil {
            throw .invalidSyncBlock("activityKey")
        }
        guard categoryPath.utf16.count <= 96,
            categoryPath.wholeMatch(of: /[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*/) != nil
        else { throw .invalidSyncBlock("categoryPath") }
        guard categoryLevels.contains(level) else { throw .invalidSyncBlock("level") }
        guard (1...blockSeconds).contains(seconds) else { throw .invalidSyncBlock("seconds") }
        self.deviceId = deviceId
        self.blockStart = blockStart
        self.activityKey = activityKey
        self.categoryPath = categoryPath
        self.level = level
        self.source = source
        self.seconds = seconds
    }

    public enum CodingKeys: String, CodingKey, CaseIterable {
        case deviceId, blockStart, activityKey, categoryPath, level, source, seconds
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        try self.init(
            deviceId: container.decode(String.self, forKey: .deviceId),
            blockStart: container.decode(String.self, forKey: .blockStart),
            activityKey: container.decodeNullable(String.self, forKey: .activityKey),
            categoryPath: container.decode(String.self, forKey: .categoryPath),
            level: container.decode(Int.self, forKey: .level),
            source: container.decode(ActivitySource.self, forKey: .source),
            seconds: container.decode(Int.self, forKey: .seconds)
        )
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(deviceId, forKey: .deviceId)
        try container.encode(blockStart, forKey: .blockStart)
        try container.encode(activityKey, forKey: .activityKey)
        try container.encode(categoryPath, forKey: .categoryPath)
        try container.encode(level, forKey: .level)
        try container.encode(source, forKey: .source)
        try container.encode(seconds, forKey: .seconds)
    }

    /// Canonical block order, see `BlockDraft.compare`.
    public static func compare(_ lhs: SyncBlock, _ rhs: SyncBlock) -> Int {
        BlockDraft.compare(BlockDraft(lhs), BlockDraft(rhs))
    }
}

/// A block's fields before the cap: `seconds` may still exceed `blockSeconds`
/// until it is scaled. `syncBlock()` is the only way to a `SyncBlock`.
struct BlockDraft: Hashable, SecondsCarrying {
    var deviceId: String
    var blockStart: String
    var activityKey: String?
    var categoryPath: String
    var level: Int
    var source: ActivitySource
    var seconds: Int

    init(
        deviceId: String,
        blockStart: String,
        activityKey: String?,
        categoryPath: String,
        level: Int,
        source: ActivitySource,
        seconds: Int
    ) {
        self.deviceId = deviceId
        self.blockStart = blockStart
        self.activityKey = activityKey
        self.categoryPath = categoryPath
        self.level = level
        self.source = source
        self.seconds = seconds
    }

    init(_ block: SyncBlock) {
        self.init(
            deviceId: block.deviceId,
            blockStart: block.blockStart,
            activityKey: block.activityKey,
            categoryPath: block.categoryPath,
            level: block.level,
            source: block.source,
            seconds: block.seconds
        )
    }

    func syncBlock() throws(AnalyticsError) -> SyncBlock {
        try SyncBlock(
            deviceId: deviceId,
            blockStart: blockStart,
            activityKey: activityKey,
            categoryPath: categoryPath,
            level: level,
            source: source,
            seconds: seconds
        )
    }

    /// Canonical block order: `blockStart`, `deviceId`, `activityKey` (nil
    /// first), `categoryPath`, then `source` (by wire code) and `level`, so
    /// the order is total. Strings compare by UTF-16 code unit, like every
    /// platform. Within one block start it is also the remainder tie order (§10.9).
    static func compare(_ lhs: BlockDraft, _ rhs: BlockDraft) -> Int {
        let byText = [
            CodeUnitOrder.compare(lhs.blockStart, rhs.blockStart),
            CodeUnitOrder.compare(lhs.deviceId, rhs.deviceId),
            CodeUnitOrder.compareNullable(lhs.activityKey, rhs.activityKey),
            CodeUnitOrder.compare(lhs.categoryPath, rhs.categoryPath),
            CodeUnitOrder.compare(lhs.source.rawValue, rhs.source.rawValue),
        ]
        return byText.first { $0 != 0 } ?? (lhs.level - rhs.level)
    }
}
