// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Reads one JSON object of a bridge payload the way its schema does:
/// exactly the allowed keys (`additionalProperties: false`), every required
/// key present, typed values with their bounds. Any mismatch is
/// `BridgeRejection.invalidPayload`; nothing about the value is kept in the error.
struct BridgePayloadReader {
    private let members: [String: JSONValue]

    init(_ value: JSONValue, required: Set<String>, optional: Set<String> = []) throws(BridgeRejection) {
        guard case .object(let members) = value else { throw .invalidPayload }
        let keys = Set(members.keys)
        guard required.isSubset(of: keys), keys.isSubset(of: required.union(optional)) else {
            throw .invalidPayload
        }
        self.members = members
    }

    func has(_ key: String) -> Bool {
        members[key] != nil
    }

    func value(_ key: String) throws(BridgeRejection) -> JSONValue {
        guard let value = members[key] else { throw .invalidPayload }
        return value
    }

    func bool(_ key: String) throws(BridgeRejection) -> Bool {
        guard case .bool(let flag) = try value(key) else { throw .invalidPayload }
        return flag
    }

    /// A string of at most `maxLength` code points that fully matches `pattern` when given.
    func string(_ key: String, maxLength: Int = .max, pattern: BridgePattern? = nil) throws(BridgeRejection)
        -> String
    {
        guard case .string(let text) = try value(key) else { throw .invalidPayload }
        guard text.unicodeScalars.count <= maxLength else { throw .invalidPayload }
        if let pattern, !pattern.matches(text) { throw .invalidPayload }
        return text
    }

    /// A string member that may be `null` (but must be present).
    func nullableString(_ key: String, maxLength: Int = .max, pattern: BridgePattern? = nil)
        throws(BridgeRejection) -> String?
    {
        if case .null = try value(key) { return nil }
        return try string(key, maxLength: maxLength, pattern: pattern)
    }

    /// A string member that may be absent.
    func optionalString(_ key: String, maxLength: Int = .max, pattern: BridgePattern? = nil)
        throws(BridgeRejection) -> String?
    {
        guard has(key) else { return nil }
        return try string(key, maxLength: maxLength, pattern: pattern)
    }

    /// One of `allowed`.
    func literal(_ key: String, in allowed: Set<String>) throws(BridgeRejection) -> String {
        let text = try string(key)
        guard allowed.contains(text) else { throw .invalidPayload }
        return text
    }

    /// An integral JSON number within `range` (`1.0` counts as `1`, `1.5` never does).
    func integer(_ key: String, in range: ClosedRange<Int>) throws(BridgeRejection) -> Int {
        guard case .number(let number) = try value(key), number == number.rounded(),
            number >= Double(range.lowerBound), number <= Double(range.upperBound)
        else { throw .invalidPayload }
        return Int(number)
    }

    func optionalInteger(_ key: String, in range: ClosedRange<Int>) throws(BridgeRejection) -> Int? {
        guard has(key) else { return nil }
        return try integer(key, in: range)
    }

    /// A JSON object member, as is.
    func object(_ key: String) throws(BridgeRejection) -> [String: JSONValue] {
        guard case .object(let members) = try value(key) else { throw .invalidPayload }
        return members
    }
}
