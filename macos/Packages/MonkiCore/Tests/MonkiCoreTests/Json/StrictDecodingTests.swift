// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// The models decode strictly (SEMANTICS.md §1): no unknown keys, no
/// duplicate keys, every required key present (also when it may be null),
/// and they encode back to the same JSON.
@Suite("strict decoding")
struct StrictDecodingTests {
    private let decoder = StrictJSONDecoder()

    private static let rule =
        #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[],"enabled":true}"#

    @Test("a valid rule decodes")
    func aValidRuleDecodes() throws {
        let rule = try decoder.decode(Rule.self, from: Self.rule)
        #expect(rule == Rule(id: "r-x", target: .site(domain: "x.com", path: nil), mode: .block))
    }

    @Test(
        "an unknown key is rejected at any depth",
        arguments: [
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[],"enabled":true,"extra":1}"#,
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com","port":1},"mode":"block","schedules":[],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"app","package":"a.b","path":"/"},"mode":"block","schedules":[],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[{"ref":"workHours","x":1}],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[{"days":["mon"],"start":"09:00","end":"10:00","tz":"UTC"}],"enabled":true}"#,
        ])
    func anUnknownKeyIsRejectedAtAnyDepth(text: String) {
        #expect(throws: (any Error).self) { try decoder.decode(Rule.self, from: text) }
    }

    @Test("a duplicate key is rejected")
    func aDuplicateKeyIsRejected() {
        let text =
            #"{"id":"r-x","id":"r-y","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[],"enabled":true}"#
        #expect(throws: JSONSyntaxError.duplicateKey("id")) { try decoder.decode(Rule.self, from: text) }
    }

    @Test(
        "malformed values are rejected",
        arguments: [
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"open","schedules":[],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"web","domain":"x.com"},"mode":"block","schedules":[],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[{"days":["mon"],"start":"9:00","end":"10:00"}],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","schedules":[{"ref":"bedtime"}],"enabled":true}"#,
            #"{"id":"r-x","target":{"kind":"site","domain":"x.com"},"mode":"block","enabled":true}"#,
        ])
    func malformedValuesAreRejected(text: String) {
        #expect(throws: (any Error).self) { try decoder.decode(Rule.self, from: text) }
    }

    @Test("a required nullable key must be present")
    func aRequiredNullableKeyMustBePresent() throws {
        let complete =
            #"{"access":"allow","content":"show","ruleId":null,"reason":"no_rule","explanationKey":"decision.no_rule","validUntil":"2026-10-26T00:00:00Z"}"#
        let missing =
            #"{"access":"allow","content":"show","reason":"no_rule","explanationKey":"decision.no_rule","validUntil":null}"#
        #expect(try decoder.decode(Decision.self, from: complete).ruleId == nil)
        #expect(throws: (any Error).self) { try decoder.decode(Decision.self, from: missing) }
        let observation = #"{"kind":"app","package":"com.example.reader"}"#
        #expect(throws: (any Error).self) { try decoder.decode(Observation.self, from: observation) }
    }

    private func reencoded<T: Codable>(_ type: T.Type, _ text: String) throws -> JSONValue {
        try StrictJSONParser.parse(JSONEncoder().encode(decoder.decode(type, from: text)))
    }

    @Test("models encode back to the json they were decoded from")
    func modelsEncodeBackToTheJsonTheyWereDecodedFrom() throws {
        let decision =
            #"{"access":"gate","content":"show","ruleId":"r-x","reason":"intention_required","gate":{"level":0,"pauseSeconds":5,"frictionType":"countdown","requiresTypedIntention":false,"requiresGuardianKey":false},"explanationKey":"decision.intention_required","validUntil":"2026-10-26T00:00:00Z"}"#
        let observation = #"{"kind":"app","package":"com.example.reader","surface":null}"#
        let event = #"{"type":"commit","minutes":5,"typedWords":3,"guardianKeyVerified":false}"#

        #expect(try reencoded(Rule.self, Self.rule) == StrictJSONParser.parse(Self.rule))
        #expect(try reencoded(Decision.self, decision) == StrictJSONParser.parse(decision))
        #expect(try reencoded(Observation.self, observation) == StrictJSONParser.parse(observation))
        #expect(try reencoded(EscalationEvent.self, event) == StrictJSONParser.parse(event))
    }

    @Test(
        "the strict parser rejects what json parse would quietly accept or reject",
        arguments: [
            "{\"a\":1,}", "[1,]", "01", "1.", ".5", "+1", "\"\\x\"", "\"tab\there\"", "{\"a\" 1}", "[1] [2]",
            "\"\\udc00\"",
            "\"\\ud800\\u0041\"", "1e999", "nul", "",
        ])
    func theStrictParserRejects(text: String) {
        #expect(throws: JSONSyntaxError.self) { try StrictJSONParser.parse(text) }
    }

    @Test("the strict parser reads every json value")
    func theStrictParserReadsEveryJsonValue() throws {
        let value = try StrictJSONParser.parse(#" {"a":[1,-2.5e2,true,false,null,"\u00e9\ud83d\ude00\n"],"b":{}} "#)
        #expect(
            value
                == .object([
                    "a": .array([.number(1), .number(-250), .bool(true), .bool(false), .null, .string("é😀\n")]),
                    "b": .object([:]),
                ]))
    }
}
