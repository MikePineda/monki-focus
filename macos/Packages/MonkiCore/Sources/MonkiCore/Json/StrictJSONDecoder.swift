// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Decodes the rules models strictly: the text must be strict JSON (no
/// duplicate keys, see ``StrictJSONParser``) and every model rejects keys
/// its schema does not define (`additionalProperties: false` everywhere,
/// SEMANTICS.md §1). Required keys must be present, even when their value
/// may be `null`.
public struct StrictJSONDecoder: Sendable {
    public init() {}

    public func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        _ = try StrictJSONParser.parse(data)
        return try JSONDecoder().decode(type, from: data)
    }

    public func decode<T: Decodable>(_ type: T.Type, from text: String) throws -> T {
        try decode(type, from: Data(text.utf8))
    }
}

/// A coding key for any name, used to list the keys a JSON object really has.
struct AnyCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = String(intValue)
        self.intValue = intValue
    }
}

extension Decoder {
    /// The keyed container of a model whose keys are `Keys`; any other key in
    /// the JSON object is a decoding error.
    func strictContainer<Keys: CodingKey & CaseIterable>(keyedBy keys: Keys.Type) throws
        -> KeyedDecodingContainer<Keys>
    {
        let allowed = Set(Keys.allCases.map(\.stringValue))
        let present = try container(keyedBy: AnyCodingKey.self)
        if let unknown = present.allKeys.first(where: { !allowed.contains($0.stringValue) }) {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: codingPath + [unknown],
                    debugDescription: "Unknown key \(unknown.stringValue)"
                )
            )
        }
        return try container(keyedBy: Keys.self)
    }
}

extension KeyedDecodingContainer {
    /// A required key whose value may be `null`: missing is an error, `null` is nil.
    func decodeNullable<T: Decodable>(_ type: T.Type, forKey key: Key) throws -> T? {
        guard contains(key) else {
            throw DecodingError.keyNotFound(
                key,
                DecodingError.Context(codingPath: codingPath, debugDescription: "Missing required key")
            )
        }
        return try decodeNil(forKey: key) ? nil : decode(type, forKey: key)
    }

    /// A string that must equal one of the given raw values.
    func decodeLiteral(_ expected: String, forKey key: Key) throws {
        let value = try decode(String.self, forKey: key)
        guard value == expected else {
            throw DecodingError.dataCorruptedError(
                forKey: key,
                in: self,
                debugDescription: "Expected \(expected)"
            )
        }
    }
}
