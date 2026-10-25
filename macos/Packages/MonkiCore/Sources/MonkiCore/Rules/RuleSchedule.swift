// SPDX-License-Identifier: AGPL-3.0-or-later

/// One schedule of a rule: a window of its own or `{"ref": "workHours"}`,
/// the rule set's work hours.
public enum RuleSchedule: Hashable, Sendable, Codable {
    case window(Schedule)
    case workHours

    private enum RefKeys: String, CodingKey, CaseIterable {
        case ref
    }

    public init(from decoder: any Decoder) throws {
        let keys = try decoder.container(keyedBy: AnyCodingKey.self)
        if keys.contains(AnyCodingKey(stringValue: "ref")) {
            let container = try decoder.strictContainer(keyedBy: RefKeys.self)
            try container.decodeLiteral("workHours", forKey: .ref)
            self = .workHours
        } else {
            self = .window(try Schedule(from: decoder))
        }
    }

    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .window(let schedule):
            try schedule.encode(to: encoder)
        case .workHours:
            var container = encoder.container(keyedBy: RefKeys.self)
            try container.encode("workHours", forKey: .ref)
        }
    }
}
