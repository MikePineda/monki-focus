// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Feeds the extension's web tab heartbeats (`browser.activity`) into the
/// capture's `HeartbeatQueue`: one `web.tab.current` bucket per browser
/// (`monki-web-<browser>_<host>`, the ActivityWatch naming that pairs it
/// with the browser's window events), merged with the extension's pulsetime
/// and written with the rest of the batch.
///
/// A heartbeat more than `maxSkewSeconds` away from the app's clock is
/// dropped: it cannot be a live heartbeat of this machine and would only
/// distort the timeline.
@MainActor
public final class BrowserActivityRecorder {
    /// The extension's production pulsetime (`TrackingTiming`, 45 s).
    public static let browserPulsetimeSeconds = 45
    public static let defaultMaxSkewSeconds = 300
    /// The ActivityWatch `client` of web buckets.
    public static let webClient = "monki-focus-web"

    private let queue: HeartbeatQueue
    private let hostname: String
    private let deviceId: String
    private let wall: any MonkiCore.Clock
    private let maxSkewSeconds: Int

    public init(
        queue: HeartbeatQueue, hostname: String, deviceId: String, wall: any MonkiCore.Clock,
        maxSkewSeconds: Int = defaultMaxSkewSeconds
    ) {
        self.queue = queue
        self.hostname = hostname
        self.deviceId = deviceId
        self.wall = wall
        self.maxSkewSeconds = maxSkewSeconds
    }

    public func bucket(for browser: HelloPayload.Browser) -> BucketDescriptor {
        let now = Int(wall.now().timeIntervalSince1970.rounded(.down))
        return BucketDescriptor(
            id: activityWatchBucketId(.webTabCurrent, hostname: hostname, browser: browser.rawValue),
            type: .webTabCurrent,
            client: Self.webClient,
            hostname: hostname,
            deviceId: deviceId,
            created: utcInstantOf(now)
        )
    }

    /// Returns whether the heartbeat was taken.
    @discardableResult
    public func record(_ heartbeat: BrowserActivityPayload, from browser: HelloPayload.Browser) -> Bool {
        let now = Int(wall.now().timeIntervalSince1970.rounded(.down))
        guard let start = try? epochSecondsOf(heartbeat.timestamp),
            abs(start + heartbeat.duration - now) <= maxSkewSeconds
        else {
            BridgeLog.event("browser heartbeat outside the clock window dropped")
            return false
        }
        let bucket = bucket(for: browser)
        if !queue.isRegistered(bucket.id) {
            do {
                try queue.register(bucket, pulsetime: Self.browserPulsetimeSeconds)
            } catch {
                BridgeLog.failure("web bucket registration failed", error)
                return false
            }
        }
        return queue.heartbeat(heartbeat.event, bucketId: bucket.id)
    }
}
