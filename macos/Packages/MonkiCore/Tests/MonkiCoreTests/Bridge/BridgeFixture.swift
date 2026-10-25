// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting
import Testing

/// One file of `packages/protocol/fixtures/bridge/<folder>` (shapes in its README).
struct BridgeFixture: Sendable, CustomTestStringConvertible {
    struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    let name: String
    let json: JSONValue

    var testDescription: String { name }

    static func all(_ folder: String) throws -> [BridgeFixture] {
        let directory = RepositoryPaths.bridgeFixtures.appending(path: folder, directoryHint: .isDirectory)
        return try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
            .map { url in
                let json = try StrictJSONParser.parse(Data(contentsOf: url))
                guard let name = json["name"]?.stringValue, name == url.deletingPathExtension().lastPathComponent else {
                    throw Failure(description: "\(url.lastPathComponent) is not named after its file")
                }
                return BridgeFixture(name: name, json: json)
            }
    }

    func string(_ key: String) throws -> String {
        guard let value = json[key]?.stringValue else { throw Failure(description: "\(name): no \(key)") }
        return value
    }

    var direction: BridgeDirection {
        get throws {
            guard let direction = BridgeDirection(rawValue: try string("direction")) else {
                throw Failure(description: "\(name): unknown direction")
            }
            return direction
        }
    }

    /// The bytes a validator receives: the raw `text`, or the compact
    /// serialisation of `message` after `padTo`.
    var bytes: Data {
        get throws {
            if let text = json["text"]?.stringValue { return Data(text.utf8) }
            guard var message = json["message"] else { throw Failure(description: "\(name): no message") }
            if case .object(let pad)? = json["padTo"], let pointer = pad["pointer"]?.stringValue,
                case .number(let bytes)? = pad["bytes"]
            {
                let segments = pointer.split(separator: "/").map(String.init)
                message = Self.setting(message, at: segments[...], to: .string(""))
                let base = JSONValueWriter.data(message).count
                let filler = String(repeating: "x", count: Int(bytes) - base)
                message = Self.setting(message, at: segments[...], to: .string(filler))
            }
            return JSONValueWriter.data(message)
        }
    }

    private static func setting(_ value: JSONValue, at path: ArraySlice<String>, to leaf: JSONValue) -> JSONValue {
        guard let key = path.first else { return leaf }
        guard case .object(var members) = value else { return value }
        members[key] = setting(members[key] ?? .null, at: path.dropFirst(), to: leaf)
        return .object(members)
    }
}

extension Data {
    init(hex: String) {
        var bytes: [UInt8] = []
        var index = hex.startIndex
        while index < hex.endIndex {
            let next = hex.index(index, offsetBy: 2)
            bytes.append(UInt8(hex[index..<next], radix: 16) ?? 0)
            index = next
        }
        self.init(bytes)
    }
}
