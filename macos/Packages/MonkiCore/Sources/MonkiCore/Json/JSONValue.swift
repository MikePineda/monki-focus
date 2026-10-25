// SPDX-License-Identifier: AGPL-3.0-or-later

/// A parsed JSON value. Objects are unordered (the strict parser rejects
/// duplicate keys, so a dictionary loses nothing) and numbers are doubles,
/// compared like JSON Schema compares them (`1` equals `1.0`). Equality and
/// hashing are structural and independent of key order.
public enum JSONValue: Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    /// The value at a JSON pointer (`/target`, `/a/0`), or nil when it does not exist.
    public func value(at pointer: String) -> JSONValue? {
        var current: JSONValue? = self
        for segment in pointer.split(separator: "/", omittingEmptySubsequences: false).dropFirst() {
            let key = String(segment).replacingOccurrences(of: "~1", with: "/").replacingOccurrences(
                of: "~0", with: "~")
            switch current {
            case .object(let members):
                current = members[key]
            case .array(let items):
                guard let index = Int(key), items.indices.contains(index) else { return nil }
                current = items[index]
            default:
                return nil
            }
        }
        return current
    }

    public subscript(key: String) -> JSONValue? {
        if case .object(let members) = self { return members[key] }
        return nil
    }

    public var stringValue: String? {
        if case .string(let text) = self { return text }
        return nil
    }
}
