// SPDX-License-Identifier: AGPL-3.0-or-later

/// A day of the week, in the order of the schema (`mon` … `sun`).
public enum Weekday: String, Codable, CaseIterable, Sendable {
    case mon, tue, wed, thu, fri, sat, sun

    /// Monday = 0 … Sunday = 6.
    public var index: Int {
        switch self {
        case .mon: 0
        case .tue: 1
        case .wed: 2
        case .thu: 3
        case .fri: 4
        case .sat: 5
        case .sun: 6
        }
    }
}
