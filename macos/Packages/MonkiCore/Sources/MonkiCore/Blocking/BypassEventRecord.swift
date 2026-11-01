// SPDX-License-Identifier: AGPL-3.0-or-later

/// A bypass event for the local outbox, in the device API's `BypassEvent`
/// shape (`bypass-event.schema.json`). It holds a kind and `BypassDetails`
/// only, so no bundle id, window title, URL or rule id can travel in it.
public struct BypassEventRecord: Hashable, Sendable {
    public let dedupeKey: String
    public let kind: BypassKind
    /// UTC instant (`YYYY-MM-DDTHH:MM:SSZ`) of the grant.
    public let occurredAt: String
    public let details: BypassDetails

    private static let dedupeKeyPattern = BridgePattern(#"^[A-Za-z0-9._:-]{1,96}$"#)

    /// The record of a granted emergency override, or nil when the key or instant break the contract.
    public static func emergencyOverride(_ grant: EmergencyGrant, occurredAt: String, dedupeKey: String)
        -> BypassEventRecord?
    {
        guard dedupeKeyPattern.matches(dedupeKey), BridgePattern.utcInstant.matches(occurredAt) else { return nil }
        let details = BypassDetails(
            scope: grant.group == bedtimeGroup ? .bedtime : .rule,
            waitSeconds: Int(grant.waited.components.seconds),
            durationSeconds: Int(grant.access.components.seconds)
        )
        return BypassEventRecord(
            dedupeKey: dedupeKey, kind: .emergencyOverride, occurredAt: occurredAt, details: details)
    }

    private init(dedupeKey: String, kind: BypassKind, occurredAt: String, details: BypassDetails) {
        self.dedupeKey = dedupeKey
        self.kind = kind
        self.occurredAt = occurredAt
        self.details = details
    }

    /// The JSON the outbox stores and a later sync sends, with sorted keys.
    public var jsonText: String {
        let payload = BypassEventPayload(
            dedupeKey: dedupeKey,
            occurredAt: occurredAt,
            details: .init(
                scope: details.scope, waitSeconds: details.waitSeconds, durationSeconds: details.durationSeconds)
        )
        return JSONValueWriter.string(payload.json)
    }
}
