// SPDX-License-Identifier: AGPL-3.0-or-later

/// The only details a bypass event may carry: where the override was taken
/// and how long it waited and lasted. Enums and bounded integers, never text.
public struct BypassDetails: Hashable, Sendable {
    public let scope: BypassEventPayload.Scope
    public let waitSeconds: Int
    public let durationSeconds: Int

    public init(scope: BypassEventPayload.Scope, waitSeconds: Int, durationSeconds: Int) {
        self.scope = scope
        self.waitSeconds = min(max(waitSeconds, 0), 3_600)
        self.durationSeconds = min(max(durationSeconds, 0), 86_400)
    }
}
