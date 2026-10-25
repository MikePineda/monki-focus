// SPDX-License-Identifier: AGPL-3.0-or-later

/// The outcome of `nextEscalation`: the next state and the effects to perform.
public struct EscalationResult: Hashable, Sendable, Codable {
    public var state: EscalationState
    public var effects: [EscalationEffect]

    public init(state: EscalationState, effects: [EscalationEffect]) {
        self.state = state
        self.effects = effects
    }

    enum CodingKeys: String, CodingKey, CaseIterable {
        case state, effects
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.strictContainer(keyedBy: CodingKeys.self)
        state = try container.decode(EscalationState.self, forKey: .state)
        effects = try container.decode([EscalationEffect].self, forKey: .effects)
    }
}
