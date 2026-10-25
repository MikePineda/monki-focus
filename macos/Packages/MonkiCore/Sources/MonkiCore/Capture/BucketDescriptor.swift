// SPDX-License-Identifier: AGPL-3.0-or-later

/// A local bucket without its events (plan §3.1): what the store keeps per
/// bucket and what the ActivityWatch export needs.
public struct BucketDescriptor: Hashable, Sendable {
    /// The `client` of every bucket the Mac app writes.
    public static let macClient = "monki-focus-mac"

    public var id: String
    public var type: ActivityWatchBucketType
    public var client: String
    public var hostname: String
    public var deviceId: String
    /// UTC instant the bucket was created.
    public var created: String

    public init(
        id: String, type: ActivityWatchBucketType, client: String, hostname: String, deviceId: String,
        created: String
    ) {
        self.id = id
        self.type = type
        self.client = client
        self.hostname = hostname
        self.deviceId = deviceId
        self.created = created
    }

    /// A Mac app bucket, with the aw-watcher id convention (`monki-window_<host>`, `monki-afk_<host>`).
    public static func mac(
        _ type: ActivityWatchBucketType, hostname: String, deviceId: String, created: String
    ) -> BucketDescriptor {
        BucketDescriptor(
            id: activityWatchBucketId(type, hostname: hostname),
            type: type,
            client: macClient,
            hostname: hostname,
            deviceId: deviceId,
            created: created
        )
    }
}
