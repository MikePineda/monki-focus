// SPDX-License-Identifier: AGPL-3.0-or-later

/// Invalid input to an analytics function. Instants and zones fail with the
/// engine's `EngineError`; these are the analytics-only cases.
public enum AnalyticsError: Error, Equatable, Sendable {
    /// A sync block field that does not fit `activity.schema.json#/$defs/block` (the field name).
    case invalidSyncBlock(String)
    /// A category level other than 0, 25, 50, 75 or 100.
    case invalidLevel(Int)
    /// Two buckets of one ActivityWatch export share an id.
    case duplicateBucketId(String)
    /// An event whose data does not fit its bucket's type.
    case eventDoesNotFitBucket(ActivityWatchBucketType)
    /// ActivityWatch event data with a missing or mistyped key (the key).
    case invalidEventData(String)
}
