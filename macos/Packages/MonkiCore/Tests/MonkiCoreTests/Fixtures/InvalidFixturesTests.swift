// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// SEMANTICS.md §1, §12: every `invalid` fixture is rejected by the Swift
/// validator with its code, and so is the oversized document the runners
/// generate themselves (it is never committed).
@Suite("invalid fixtures")
struct InvalidFixturesTests {
    @Test("invalid", arguments: try FixtureLoader.load("invalid"))
    func invalid(_ fixture: Fixture) throws {
        let parsed = try fixture.decode(InvalidFixture.self)
        #expect(parsed.then.rejected)
        let document = try #require(try StrictJSONParser.parse(fixture.data)["document"])
        let result = try RulesPackage.validator().validate(schema: parsed.schema, value: document)
        #expect(result.code == parsed.then.code, "\(result)")
    }

    @Test("a document over 256 KiB is rejected as too large")
    func aDocumentOver256KiBIsRejectedAsTooLarge() throws {
        let validator = try RulesPackage.validator()
        let note = String(repeating: "n", count: 120)
        let rules = (0..<500)
            .map { index in
                #"{"id":"r-\#(index)","target":{"kind":"site","domain":"example.org"},"mode":"block","#
                    + #""schedules":[],"enabled":true,"note":"\#(note)"}"#
            }
            .joined(separator: ",")
        let text = """
            {"schemaVersion":1,"revision":1,"updatedAt":"2026-10-01T00:00:00Z","timeZone":"UTC","rules":[\(rules)],\
            "categories":[],"bedtime":{"enabled":false,"days":["mon"],"start":"22:30","end":"07:00",\
            "warnMinutesBefore":30},"workHours":{"days":["mon"],"start":"09:00","end":"17:30"}}
            """
        let padded = text.replacingOccurrences(
            of: "\"rules\":[", with: "\"rules\":[" + String(repeating: " ", count: 200_000))

        #expect(padded.utf8.count > RulesetValidator.maxDocumentBytes)
        #expect(validator.validateDocument(schema: "ruleset", text: padded).code == .tooLarge)
        // Under the limit, the same document is judged on its content (here: valid).
        #expect(text.utf8.count <= RulesetValidator.maxDocumentBytes)
        #expect(validator.validateDocument(schema: "ruleset", text: text) == .valid)
    }

    @Test("text that is not strict JSON is rejected as invalid json")
    func textThatIsNotStrictJsonIsRejectedAsInvalidJson() throws {
        let validator = try RulesPackage.validator()
        for text in ["{", "{\"a\":1,}", "{\"a\":1,\"a\":2}", "[1] x", "NaN", "{'a':1}", "\"\\ud800\""] {
            #expect(validator.validateDocument(schema: "ruleset", text: text).code == .invalidJson, "\(text)")
        }
    }
}
