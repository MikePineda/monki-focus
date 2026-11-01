// SPDX-License-Identifier: AGPL-3.0-or-later

/// An emergency override that has just been granted: the adapter records it
/// as a `BypassEventRecord` before anything is lifted.
public struct EmergencyGrant: Hashable, Sendable {
    /// The escalation group (a rule id, or `bedtime`). It stays on the device.
    public let group: String
    public let waited: Duration
    public let access: Duration

    public init(group: String, waited: Duration, access: Duration) {
        self.group = group
        self.waited = waited
        self.access = access
    }
}
