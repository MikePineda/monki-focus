// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §12: a runner per kind, loud failures, nothing skipped.
@Suite("fixture runner coverage")
struct RunnerCoverageTests {
    /// Kinds MonkiCore runs; each has a `@Test(arguments:)` runner in this directory.
    static let runHere = [
        "decision", "specificity", "url-normalize", "schedule", "escalation", "rule-change", "candidates", "invalid",
        "activity",
    ]

    /// Kinds other packages run: `unlock-token` (packages/protocol, verified by the token verifier).
    static let runElsewhere = ["unlock-token"]

    /// `fixtures/` directories that are not kinds: `detectors/` holds the Android UI dumps.
    static let notKinds = ["detectors"]

    @Test("runs every fixture kind the rules package declares")
    func runsEveryFixtureKindTheRulesPackageDeclares() throws {
        let declared = try FixtureLoader.declaredKinds().filter { !Self.runElsewhere.contains($0) }

        #expect(declared.sorted() == Self.runHere.sorted())
    }

    @Test("runs every fixture directory that exists")
    func runsEveryFixtureDirectoryThatExists() throws {
        let directories = try FileManager.default
            .contentsOfDirectory(at: RulesPackage.url("fixtures"), includingPropertiesForKeys: [.isDirectoryKey])
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true }
            .map(\.lastPathComponent)
            .filter { !Self.runElsewhere.contains($0) && !Self.notKinds.contains($0) }

        #expect(directories.sorted() == Self.runHere.sorted())
    }

    @Test("the activity kind is run here")
    func theActivityKindIsRunHere() {
        #expect(Self.runHere.contains("activity"))
        #expect(!Self.runElsewhere.contains("activity"))
    }

    @Test("every kind run here has fixtures and unique ids")
    func everyKindRunHereHasFixturesAndUniqueIds() throws {
        let loaded = try Self.runHere.map { try FixtureLoader.load($0) }

        #expect(loaded.allSatisfy { !$0.isEmpty })
        let ids = loaded.flatMap { $0.map(\.id) }
        #expect(Set(ids).count == ids.count)
    }

    @Test("unknown fixture kind fails loudly")
    func unknownFixtureKindFailsLoudly() {
        #expect(throws: FixtureLoader.Failure.self) { try FixtureLoader.load("mystery") }
    }

    @Test("a misfiled or invalid fixture fails loudly")
    func aMisfiledOrInvalidFixtureFailsLoudly() throws {
        let source = try #require(try FixtureLoader.load("schedule").first)
        let name = String(source.id.dropFirst("schedule.".count)) + ".json"
        let root = FileManager.default.temporaryDirectory.appending(path: "monki-fixtures-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }

        let misfiled = root.appending(path: "misfiled/escalation")
        try FileManager.default.createDirectory(at: misfiled, withIntermediateDirectories: true)
        try source.data.write(to: misfiled.appending(path: name))
        #expect(throws: FixtureLoader.Failure.self) {
            try FixtureLoader.load("escalation", root: misfiled.deletingLastPathComponent())
        }

        let renamed = root.appending(path: "renamed/schedule")
        try FileManager.default.createDirectory(at: renamed, withIntermediateDirectories: true)
        try source.data.write(to: renamed.appending(path: "wrong_name.json"))
        #expect(throws: FixtureLoader.Failure.self) {
            try FixtureLoader.load("schedule", root: renamed.deletingLastPathComponent())
        }

        let broken = root.appending(path: "broken/schedule")
        try FileManager.default.createDirectory(at: broken, withIntermediateDirectories: true)
        try Data(#"{"id": 1}"#.utf8).write(to: broken.appending(path: name))
        #expect(throws: FixtureLoader.Failure.self) {
            try FixtureLoader.load("schedule", root: broken.deletingLastPathComponent())
        }
    }
}
