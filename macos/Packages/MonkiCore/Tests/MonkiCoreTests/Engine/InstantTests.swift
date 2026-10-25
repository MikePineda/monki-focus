// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import Testing

/// Instants (SEMANTICS.md §1): strict RFC 3339 in, UTC with `Z` out.
@Suite("instants")
struct InstantTests {
    @Test("an instant with an offset or z is read as whole epoch seconds")
    func anInstantWithAnOffsetOrZIsReadAsWholeEpochSeconds() throws {
        #expect(try epochSecondsOf("2026-10-25T23:00:00Z") == 1_792_969_200)
        #expect(try epochSecondsOf("2026-10-26T10:00:00+11:00") == 1_792_969_200)
        #expect(try epochSecondsOf("2026-10-25T13:00:00-10:00") == 1_792_969_200)
        #expect(try epochSecondsOf("1970-01-01T00:00:00Z") == 0)
        #expect(try epochSecondsOf("2028-02-29T00:00:00Z") == 1_835_395_200)
    }

    @Test(
        "anything but a strict rfc 3339 instant is invalid input",
        arguments: [
            "2026-10-25T23:00:00", "2026-10-25 23:00:00Z", "2026-10-25T23:00:00.5Z", "2026-10-25t23:00:00z",
            "2026-10-25T23:00:00+1100", "2026-10-25T24:00:00Z", "2026-10-25T23:60:00Z", "2026-10-25T23:00:60Z",
            "2026-13-01T00:00:00Z", "2026-04-31T00:00:00Z", "2026-02-29T00:00:00Z", "2026-00-10T00:00:00Z",
            "2026-10-25T23:00:00+24:00", "2026-10-25T23:00:00+05:60", "２０２６-10-25T23:00:00Z", "", "now",
        ])
    func anythingButAStrictRfc3339InstantIsInvalidInput(text: String) {
        #expect(throws: EngineError.invalidInstant) { try epochSecondsOf(text) }
    }

    @Test("computed instants are written in utc without fractions")
    func computedInstantsAreWrittenInUtcWithoutFractions() {
        #expect(utcInstantOf(1_792_969_200) == "2026-10-25T23:00:00Z")
        #expect(utcInstantOf(0) == "1970-01-01T00:00:00Z")
        #expect(utcInstantOf(951_782_400) == "2000-02-29T00:00:00Z")
    }

    @Test("the now adapters pass floors the clock to whole seconds")
    func theNowAdaptersPassFloorsTheClockToWholeSeconds() throws {
        #expect(try instantOf(epochMillis: 1_792_969_200_999) == "2026-10-25T23:00:00Z")
        #expect(try instantOf(Date(timeIntervalSince1970: 1_792_969_200.75)) == "2026-10-25T23:00:00Z")
        #expect(throws: EngineError.invalidArgument) { try instantOf(epochMillis: -1) }
        #expect(throws: EngineError.invalidArgument) { try instantOf(epochMillis: .nan) }
        #expect(throws: EngineError.invalidArgument) { try instantOf(epochMillis: .infinity) }
    }
}
