// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

@testable import MonkiCore

/// A bypass event carries a kind and a few bounded details only: never a
/// bundle id, window title, URL, rule id or rule text.
@Suite("bypass event record")
struct BypassEventRecordTests {
    private static let grant = EmergencyGrant(group: "r-games", waited: .seconds(121), access: .seconds(900))

    @Test("an emergency grant becomes an emergency override record")
    func anEmergencyGrantBecomesAnEmergencyOverrideRecord() throws {
        let record = try #require(
            BypassEventRecord.emergencyOverride(
                Self.grant, occurredAt: "2026-10-26T10:02:00Z", dedupeKey: "3F2A-11"))

        #expect(record.kind == .emergencyOverride)
        #expect(record.occurredAt == "2026-10-26T10:02:00Z")
        #expect(record.details == BypassDetails(scope: .rule, waitSeconds: 121, durationSeconds: 900))
    }

    @Test("an override from the bedtime screen has the bedtime scope")
    func anOverrideFromTheBedtimeScreenHasTheBedtimeScope() throws {
        let grant = EmergencyGrant(group: "bedtime", waited: .seconds(120), access: .seconds(900))

        let record = try #require(
            BypassEventRecord.emergencyOverride(grant, occurredAt: "2026-10-26T23:00:00Z", dedupeKey: "k1"))

        #expect(record.details.scope == .bedtime)
    }

    @Test(
        "a dedupe key outside the contract pattern is refused",
        arguments: ["", "has space", "slash/key", String(repeating: "a", count: 97)])
    func aDedupeKeyOutsideTheContractPatternIsRefused(key: String) {
        #expect(
            BypassEventRecord.emergencyOverride(Self.grant, occurredAt: "2026-10-26T10:02:00Z", dedupeKey: key)
                == nil)
    }

    @Test("an occurrence that is not a UTC instant is refused")
    func anOccurrenceThatIsNotAUtcInstantIsRefused() {
        #expect(
            BypassEventRecord.emergencyOverride(Self.grant, occurredAt: "2026-10-26T10:02:00+11:00", dedupeKey: "k1")
                == nil)
    }

    @Test("the encoded record has only the allowed keys and never the group")
    func theEncodedRecordHasOnlyTheAllowedKeysAndNeverTheGroup() throws {
        let record = try #require(
            BypassEventRecord.emergencyOverride(Self.grant, occurredAt: "2026-10-26T10:02:00Z", dedupeKey: "k1"))

        let text = record.jsonText
        let object = try #require(try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any])
        let details = try #require(object["details"] as? [String: Any])

        #expect(Set(object.keys) == ["dedupeKey", "kind", "occurredAt", "details"])
        #expect(Set(details.keys) == ["scope", "waitSeconds", "durationSeconds"])
        #expect(!text.contains("r-games"))
    }

    @Test("the encoded record satisfies the bypass event contract")
    func theEncodedRecordSatisfiesTheBypassEventContract() throws {
        let record = try #require(
            BypassEventRecord.emergencyOverride(Self.grant, occurredAt: "2026-10-26T10:02:00Z", dedupeKey: "k1"))

        let payload = try BypassEventPayload(json: try StrictJSONParser.parse(record.jsonText))

        #expect(payload.dedupeKey == "k1")
        #expect(payload.occurredAt == "2026-10-26T10:02:00Z")
        #expect(payload.details == .init(scope: .rule, waitSeconds: 121, durationSeconds: 900))
    }
}
