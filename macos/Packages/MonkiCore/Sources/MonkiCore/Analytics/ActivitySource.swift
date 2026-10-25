// SPDX-License-Identifier: AGPL-3.0-or-later

/// Where a stretch of time was measured (`activity.schema.json#/$defs/source`):
/// a browser tab, a desktop app or an Android app.
public enum ActivitySource: String, Hashable, Sendable, Codable, CaseIterable {
    case web, app, android
}
