// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// One fixture file: its id (the test name in every runner) and raw bytes.
struct Fixture: Sendable, CustomTestStringConvertible, CustomStringConvertible {
    let id: String
    let data: Data

    var testDescription: String { id }
    var description: String { id }

    func decode<T: Decodable>(_ type: T.Type) throws -> T {
        try StrictJSONDecoder().decode(type, from: data)
    }
}

/// Reads the fixtures of a kind by relative path (SEMANTICS.md §12): every
/// file is validated against `schema/v1/fixture.schema.json` (including the
/// `x-*` keywords), must carry its directory's kind and be named after its
/// id. An unknown kind, an invalid shape or a misfiled fixture throws:
/// nothing is skipped.
enum FixtureLoader {
    struct Failure: Error, CustomStringConvertible {
        let description: String
    }

    /// Every kind `fixture.schema.json` declares.
    static func declaredKinds() throws -> [String] {
        let schema = try StrictJSONParser.parse(Data(contentsOf: RulesPackage.url("schema/v1/fixture.schema.json")))
        guard case .array(let kinds)? = schema.value(at: "/properties/kind/enum") else {
            throw Failure(description: "fixture.schema.json declares no kinds")
        }
        return kinds.compactMap(\.stringValue)
    }

    static func load(_ kind: String, root: URL = RulesPackage.url("fixtures")) throws -> [Fixture] {
        guard try declaredKinds().contains(kind) else { throw Failure(description: "Unknown fixture kind: \(kind)") }
        let directory = root.appending(path: kind, directoryHint: .isDirectory)
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        let validator = try RulesPackage.validator()
        return try files.map { try parse(kind: kind, file: $0, validator: validator) }.sorted { $0.id < $1.id }
    }

    private static func parse(kind: String, file: URL, validator: RulesetValidator) throws -> Fixture {
        let relative = "\(file.deletingLastPathComponent().lastPathComponent)/\(file.lastPathComponent)"
        guard file.pathExtension == "json" else { throw Failure(description: "\(relative) is not a .json fixture") }
        let data = try Data(contentsOf: file)
        let result = validator.validateDocument(schema: "fixture", data: data)
        guard result == .valid else { throw Failure(description: "\(relative) is not a valid fixture: \(result)") }
        let json = try StrictJSONParser.parse(data)
        guard let id = json["id"]?.stringValue, let fileKind = json["kind"]?.stringValue else {
            throw Failure(description: "\(relative) has no id or kind")
        }
        guard fileKind == kind else {
            throw Failure(description: "\(relative) has kind \(fileKind) but sits in the \(kind) directory")
        }
        let expectedName = (id.split(separator: ".", maxSplits: 1).last.map(String.init) ?? id) + ".json"
        guard file.lastPathComponent == expectedName else {
            throw Failure(description: "\(relative) must be named \(expectedName) after its id")
        }
        return Fixture(id: id, data: data)
    }
}
