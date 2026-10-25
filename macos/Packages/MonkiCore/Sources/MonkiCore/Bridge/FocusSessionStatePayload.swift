// SPDX-License-Identifier: AGPL-3.0-or-later

/// `focusSession.state` (`focus-session-state.schema.json`): whether a focus
/// session the user started on the Mac runs, and when it ends.
public struct FocusSessionStatePayload: Hashable, Sendable {
    /// The UTC instant the running session ends; nil when none runs.
    public var endsAt: String?

    public var active: Bool { endsAt != nil }

    public init(endsAt: String?) {
        self.endsAt = endsAt
    }

    init(json: JSONValue) throws(BridgeRejection) {
        let reader = try BridgePayloadReader(json, required: ["active", "endsAt"])
        let active = try reader.bool("active")
        endsAt = try reader.nullableString("endsAt", pattern: .utcInstant)
        guard active == (endsAt != nil) else { throw .invalidPayload }
    }

    var json: JSONValue {
        .object(["active": .bool(active), "endsAt": endsAt.map(JSONValue.string) ?? .null])
    }
}
