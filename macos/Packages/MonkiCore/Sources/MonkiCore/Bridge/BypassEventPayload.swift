// SPDX-License-Identifier: AGPL-3.0-or-later

/// `bypass.event` (`bypass-event.schema.json`): an emergency override taken
/// in the browser, in the device API's `BypassEvent` shape. Only enums and
/// bounded integers, so no domain, path or text can travel in it.
public struct BypassEventPayload: Hashable, Sendable {
    public static let emergencyOverride = "emergency_override"

    public enum Scope: String, Hashable, Sendable, CaseIterable {
        case rule, bedtime
    }

    public struct Details: Hashable, Sendable {
        public var scope: Scope?
        public var waitSeconds: Int?
        public var durationSeconds: Int?

        public init(scope: Scope? = nil, waitSeconds: Int? = nil, durationSeconds: Int? = nil) {
            self.scope = scope
            self.waitSeconds = waitSeconds
            self.durationSeconds = durationSeconds
        }
    }

    public var dedupeKey: String
    public var occurredAt: String
    public var details: Details?

    public init(dedupeKey: String, occurredAt: String, details: Details? = nil) {
        self.dedupeKey = dedupeKey
        self.occurredAt = occurredAt
        self.details = details
    }

    private static let dedupeKeyPattern = BridgePattern(#"^[A-Za-z0-9._:-]{1,96}$"#)

    init(json: JSONValue) throws(BridgeRejection) {
        let reader = try BridgePayloadReader(
            json, required: ["dedupeKey", "kind", "occurredAt"], optional: ["details"])
        dedupeKey = try reader.string("dedupeKey", pattern: Self.dedupeKeyPattern)
        _ = try reader.literal("kind", in: [Self.emergencyOverride])
        occurredAt = try reader.string("occurredAt", pattern: .utcInstant)
        guard reader.has("details") else {
            details = nil
            return
        }
        let details = try BridgePayloadReader(
            reader.value("details"), required: [], optional: ["scope", "waitSeconds", "durationSeconds"])
        let scope: Scope?
        if details.has("scope") {
            scope = Scope(rawValue: try details.literal("scope", in: Set(Scope.allCases.map(\.rawValue))))
        } else {
            scope = nil
        }
        self.details = Details(
            scope: scope,
            waitSeconds: try details.optionalInteger("waitSeconds", in: 0...3600),
            durationSeconds: try details.optionalInteger("durationSeconds", in: 0...86_400)
        )
    }

    var json: JSONValue {
        var members: [String: JSONValue] = [
            "dedupeKey": .string(dedupeKey),
            "kind": .string(Self.emergencyOverride),
            "occurredAt": .string(occurredAt),
        ]
        if let details {
            var detail: [String: JSONValue] = [:]
            if let scope = details.scope { detail["scope"] = .string(scope.rawValue) }
            if let wait = details.waitSeconds { detail["waitSeconds"] = .number(Double(wait)) }
            if let duration = details.durationSeconds { detail["durationSeconds"] = .number(Double(duration)) }
            members["details"] = .object(detail)
        }
        return .object(members)
    }
}
