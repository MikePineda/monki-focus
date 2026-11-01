// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

/// The emergency override on the Mac: a 2-minute wait, then 15 minutes of
/// access, both measured on the monotonic clock so moving the wall clock can
/// neither shorten the wait nor extend the access.
@Suite("emergency override policy")
struct EmergencyOverridePolicyTests {
    private static let start = Duration.seconds(1_000)

    private func requested(_ group: String = "r-games") -> EmergencyOverridePolicy {
        var policy = EmergencyOverridePolicy()
        policy.request(group, at: Self.start)
        return policy
    }

    @Test("the wait is two minutes and the access fifteen")
    func theWaitIsTwoMinutesAndTheAccessFifteen() {
        #expect(EmergencyOverridePolicy.waitDuration == .seconds(120))
        #expect(EmergencyOverridePolicy.accessDuration == .seconds(900))
    }

    @Test("a group without a request has no override")
    func aGroupWithoutARequestHasNoOverride() {
        let policy = EmergencyOverridePolicy()

        #expect(policy.status(of: "r-games", at: Self.start) == EmergencyStatus.none)
        #expect(!policy.lifts("r-games", at: Self.start))
    }

    @Test("a request waits two minutes before it lifts anything")
    func aRequestWaitsTwoMinutesBeforeItLiftsAnything() {
        var policy = requested()

        #expect(policy.status(of: "r-games", at: Self.start + .seconds(30)) == .waiting(remaining: .seconds(90)))
        #expect(policy.advance(to: Self.start + .seconds(119)).isEmpty)
        #expect(!policy.lifts("r-games", at: Self.start + .seconds(119)))
    }

    @Test("the grant after the wait is reported once and lifts the group for fifteen minutes")
    func theGrantAfterTheWaitIsReportedOnceAndLiftsTheGroupForFifteenMinutes() {
        var policy = requested()

        let grants = policy.advance(to: Self.start + .seconds(120))
        let again = policy.advance(to: Self.start + .seconds(121))

        #expect(grants == [EmergencyGrant(group: "r-games", waited: .seconds(120), access: .seconds(900))])
        #expect(again.isEmpty)
        #expect(policy.lifts("r-games", at: Self.start + .seconds(120 + 899)))
        #expect(policy.status(of: "r-games", at: Self.start + .seconds(420)) == .active(remaining: .seconds(600)))
    }

    @Test("a granted override ends fifteen minutes after the grant")
    func aGrantedOverrideEndsFifteenMinutesAfterTheGrant() {
        var policy = requested()
        _ = policy.advance(to: Self.start + .seconds(120))

        _ = policy.advance(to: Self.start + .seconds(120 + 900))

        #expect(!policy.lifts("r-games", at: Self.start + .seconds(120 + 900)))
        #expect(policy.status(of: "r-games", at: Self.start + .seconds(120 + 900)) == EmergencyStatus.none)
    }

    @Test("the waiting status reaches zero but nothing is lifted before the grant is recorded")
    func theWaitingStatusReachesZeroButNothingIsLiftedBeforeTheGrantIsRecorded() {
        let policy = requested()

        #expect(policy.status(of: "r-games", at: Self.start + .seconds(500)) == .waiting(remaining: .zero))
        #expect(!policy.lifts("r-games", at: Self.start + .seconds(500)))
    }

    @Test("an override lifts only its own group")
    func anOverrideLiftsOnlyItsOwnGroup() {
        var policy = requested("bedtime")
        _ = policy.advance(to: Self.start + .seconds(120))

        #expect(policy.lifts("bedtime", at: Self.start + .seconds(200)))
        #expect(!policy.lifts("r-games", at: Self.start + .seconds(200)))
    }

    @Test("requesting again while waiting or active never restarts the timers")
    func requestingAgainWhileWaitingOrActiveNeverRestartsTheTimers() {
        var policy = requested()
        policy.request("r-games", at: Self.start + .seconds(100))
        #expect(policy.advance(to: Self.start + .seconds(120)).count == 1)

        policy.request("r-games", at: Self.start + .seconds(800))

        #expect(policy.status(of: "r-games", at: Self.start + .seconds(1_020)) == EmergencyStatus.none)
    }

    @Test("cancelling during the wait drops the request and grants nothing")
    func cancellingDuringTheWaitDropsTheRequestAndGrantsNothing() {
        var policy = requested()

        policy.cancel("r-games")

        #expect(policy.advance(to: Self.start + .seconds(600)).isEmpty)
        #expect(policy.status(of: "r-games", at: Self.start + .seconds(600)) == EmergencyStatus.none)
    }

    @Test("cancelling never ends an access already granted")
    func cancellingNeverEndsAnAccessAlreadyGranted() {
        var policy = requested()
        _ = policy.advance(to: Self.start + .seconds(120))

        policy.cancel("r-games")

        #expect(policy.lifts("r-games", at: Self.start + .seconds(300)))
    }

    @Test("access counts from the grant even when the grant is late")
    func accessCountsFromTheGrantEvenWhenTheGrantIsLate() {
        var policy = requested()

        let grants = policy.advance(to: Self.start + .seconds(400))

        #expect(grants.first?.waited == .seconds(400))
        #expect(policy.lifts("r-games", at: Self.start + .seconds(400 + 899)))
        #expect(!policy.lifts("r-games", at: Self.start + .seconds(400 + 900)))
    }

    @Test("an expired access is lifted no more even before it is swept")
    func anExpiredAccessIsLiftedNoMoreEvenBeforeItIsSwept() {
        // Only monotonic readings go in, so an hour of wall-clock rewind changes nothing.
        var policy = requested()
        _ = policy.advance(to: Self.start + .seconds(120))

        #expect(!policy.lifts("r-games", at: Self.start + .seconds(120 + 900 + 3_600)))
        #expect(policy.status(of: "r-games", at: Self.start + .seconds(120 + 900)) == EmergencyStatus.none)
    }

    @Test("the groups waiting or active are listed for the presenters")
    func theGroupsWaitingOrActiveAreListedForThePresenters() {
        var policy = requested("r-games")
        policy.request("bedtime", at: Self.start)

        #expect(policy.groups == ["bedtime", "r-games"])
    }
}
