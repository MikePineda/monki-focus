// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// `{v, id, type, payload}`, checked at the envelope level only
/// (`envelope.schema.json` minus the per-type payload schemas). This is all
/// `monki-bridge` looks at: it relays a message whose envelope is valid and
/// whose type belongs to the direction it travels, and never reads the payload.
public struct BridgeEnvelope: Hashable, Sendable {
    public var id: String
    public var type: BridgeMessageType
    public var payload: [String: JSONValue]

    public init(id: String, type: BridgeMessageType, payload: [String: JSONValue]) {
        self.id = id
        self.type = type
        self.payload = payload
    }

    private static let keys: Set<String> = ["v", "id", "type", "payload"]

    /// Size, strict JSON, then the envelope (the rejection order of the fixtures).
    public static func parse(_ data: Data, from direction: BridgeDirection) throws(BridgeRejection) -> BridgeEnvelope {
        guard data.count <= BridgeContract.maxMessageBytes else { throw .tooLarge }
        let value: JSONValue
        do {
            value = try StrictJSONParser.parse(data)
        } catch {
            throw .invalidJSON
        }
        return try validate(value, from: direction)
    }

    public static func validate(_ value: JSONValue, from direction: BridgeDirection) throws(BridgeRejection)
        -> BridgeEnvelope
    {
        guard case .object(let members) = value, Set(members.keys) == keys else { throw .invalidEnvelope }
        guard case .string(let id) = members["id"], isValidId(id) else { throw .invalidEnvelope }
        guard case .string(let typeName) = members["type"] else { throw .invalidEnvelope }
        guard case .number(let version) = members["v"], version == Double(BridgeContract.envelopeVersion) else {
            throw .unsupportedVersion
        }
        guard let type = BridgeMessageType(rawValue: typeName) else { throw .unknownType }
        guard type.direction == direction else { throw .wrongDirection }
        guard case .object(let payload) = members["payload"] else { throw .payloadNotObject }
        return BridgeEnvelope(id: id, type: type, payload: payload)
    }

    /// `^[A-Za-z0-9._:-]{1,64}$`.
    public static func isValidId(_ id: String) -> Bool {
        let bytes = Array(id.utf8)
        guard (1...64).contains(bytes.count) else { return false }
        return bytes.allSatisfy { byte in
            switch byte {
            case UInt8(ascii: "A")...UInt8(ascii: "Z"), UInt8(ascii: "a")...UInt8(ascii: "z"),
                UInt8(ascii: "0")...UInt8(ascii: "9"), UInt8(ascii: "."), UInt8(ascii: "_"), UInt8(ascii: ":"),
                UInt8(ascii: "-"):
                true
            default:
                false
            }
        }
    }

    /// The envelope as JSON.
    public var json: JSONValue {
        .object([
            "v": .number(Double(BridgeContract.envelopeVersion)),
            "id": .string(id),
            "type": .string(type.rawValue),
            "payload": .object(payload),
        ])
    }

    /// Compact JSON, one NDJSON line without its line feed.
    public func encoded() -> Data {
        JSONValueWriter.data(json)
    }
}
