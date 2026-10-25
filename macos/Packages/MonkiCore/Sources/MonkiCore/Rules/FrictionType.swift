// SPDX-License-Identifier: AGPL-3.0-or-later

/// How a pause is presented. Rotates `countdown → breath → reflect →
/// type-intention → countdown` and never repeats twice in a row (§7.1).
public enum FrictionType: String, Codable, CaseIterable, Sendable {
    case countdown
    case breath
    case reflect
    case typeIntention = "type-intention"

    /// The type that follows this one in the rotation.
    public var successor: FrictionType {
        switch self {
        case .countdown: .breath
        case .breath: .reflect
        case .reflect: .typeIntention
        case .typeIntention: .countdown
        }
    }
}
