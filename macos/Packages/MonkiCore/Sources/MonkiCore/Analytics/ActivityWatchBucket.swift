// SPDX-License-Identifier: AGPL-3.0-or-later

/// The standard ActivityWatch bucket types, with their wire codes.
public enum ActivityWatchBucketType: String, Hashable, Sendable, Codable, CaseIterable {
    case currentWindow = "currentwindow"
    case afkStatus = "afkstatus"
    case webTabCurrent = "web.tab.current"
}

/// A local bucket and its events, ready to export to ActivityWatch or read back from an export.
public struct ActivityWatchBucket: Hashable, Sendable {
    public var id: String
    public var type: ActivityWatchBucketType
    /// `monki-focus-web`, `monki-focus-mac` or `monki-focus-android`.
    public var client: String
    public var hostname: String
    /// UTC instant the bucket was created.
    public var created: String
    public var events: [ActivityEvent]

    public init(
        id: String,
        type: ActivityWatchBucketType,
        client: String,
        hostname: String,
        created: String,
        events: [ActivityEvent]
    ) {
        self.id = id
        self.type = type
        self.client = client
        self.hostname = hostname
        self.created = created
        self.events = events
    }
}

/// Bucket ids follow the aw-watcher convention `<watcher>_<hostname>`. The web
/// bucket names the browser (`monki-web-chrome_<host>`) because the
/// ActivityWatch dashboard pairs web buckets with browser windows by finding
/// the browser name in the bucket id.
public func activityWatchBucketId(_ type: ActivityWatchBucketType, hostname: String, browser: String = "chrome")
    -> String
{
    switch type {
    case .currentWindow: "monki-window_\(hostname)"
    case .afkStatus: "monki-afk_\(hostname)"
    case .webTabCurrent: "monki-web-\(browser)_\(hostname)"
    }
}
