// SPDX-License-Identifier: AGPL-3.0-or-later

/// An event of the escalation state machine (`escalation.schema.json#/$defs/event`).
/// Only `commit` carries data: the intention's minutes, the number of typed
/// words (the text never reaches the engine) and whether the guardian key
/// was verified.
public enum EscalationEvent: Hashable, Sendable, Codable {
    case visit
    case pauseElapsed
    case close
    case commit(minutes: Int, typedWords: Int, guardianKeyVerified: Bool)
    case intentionExpired
    case leave
    case extend
    case emergencyRequest
    case emergencyWaitElapsed
    case emergencyExpired

    private enum Keys: String, CodingKey, CaseIterable {
        case type
    }

    private enum CommitKeys: String, CodingKey, CaseIterable {
        case type, minutes, typedWords, guardianKeyVerified
    }

    private static let simple: [String: EscalationEvent] = [
        "visit": .visit, "pause_elapsed": .pauseElapsed, "close": .close, "intention_expired": .intentionExpired,
        "leave": .leave, "extend": .extend, "emergency_request": .emergencyRequest,
        "emergency_wait_elapsed": .emergencyWaitElapsed, "emergency_expired": .emergencyExpired,
    ]

    /// The event's `type` in the schema.
    public var type: String {
        switch self {
        case .visit: "visit"
        case .pauseElapsed: "pause_elapsed"
        case .close: "close"
        case .commit: "commit"
        case .intentionExpired: "intention_expired"
        case .leave: "leave"
        case .extend: "extend"
        case .emergencyRequest: "emergency_request"
        case .emergencyWaitElapsed: "emergency_wait_elapsed"
        case .emergencyExpired: "emergency_expired"
        }
    }

    public init(from decoder: any Decoder) throws {
        let type = try decoder.container(keyedBy: Keys.self).decode(String.self, forKey: .type)
        if type == "commit" {
            let container = try decoder.strictContainer(keyedBy: CommitKeys.self)
            self = .commit(
                minutes: try container.decode(Int.self, forKey: .minutes),
                typedWords: try container.decode(Int.self, forKey: .typedWords),
                guardianKeyVerified: try container.decode(Bool.self, forKey: .guardianKeyVerified)
            )
            return
        }
        _ = try decoder.strictContainer(keyedBy: Keys.self)
        guard let event = Self.simple[type] else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unknown event type")
            )
        }
        self = event
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CommitKeys.self)
        try container.encode(type, forKey: .type)
        if case .commit(let minutes, let typedWords, let guardianKeyVerified) = self {
            try container.encode(minutes, forKey: .minutes)
            try container.encode(typedWords, forKey: .typedWords)
            try container.encode(guardianKeyVerified, forKey: .guardianKeyVerified)
        }
    }
}
