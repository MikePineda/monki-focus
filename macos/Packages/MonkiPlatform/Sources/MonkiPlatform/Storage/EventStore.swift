// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Where the heartbeat queue keeps buckets and their events.
public protocol EventStore: AnyObject {
    /// Creates the bucket if it does not exist yet; an existing bucket is kept as is.
    func register(_ bucket: BucketDescriptor) throws

    /// The bucket's latest event (by start), if any.
    func lastEvent(bucketId: String) throws -> ActivityEvent?

    /// Inserts or replaces events keyed by `(bucket, start)`, in one transaction.
    func upsert(_ events: [ActivityEvent], bucketId: String) throws
}
