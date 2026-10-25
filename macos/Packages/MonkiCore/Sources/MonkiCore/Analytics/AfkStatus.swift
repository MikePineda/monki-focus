// SPDX-License-Identifier: AGPL-3.0-or-later

/// `activity.schema.json#/$defs/afkData` status: whether the user is away
/// from the device (idle, asleep or locked) or not.
public enum AfkStatus: String, Hashable, Sendable, Codable, CaseIterable {
    case afk
    case notAfk = "not-afk"
}
