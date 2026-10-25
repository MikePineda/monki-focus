// SPDX-License-Identifier: AGPL-3.0-or-later

// Gates (SEMANTICS.md §7.1): `level = min(attemptCount − 1, 3)`; base pause
// L0 5 s, L1 15 s, L2 15 s, L3 15 s with a linked guardian and 60 s without;
// `pauseSeconds = min(base << min(brokenCount, 4), 60)`. A typed intention
// from L2, the guardian key only at L3 with a guardian. The friction type
// rotates `countdown → breath → reflect → type-intention → countdown` and is
// always the successor of the previous one, so it never repeats.

let maxAttemptCount = 1000
let maxBrokenCount = 16
private let maxPauseSeconds = 60
private let maxPauseDoublings = 4

func nextFrictionType(_ previous: FrictionType?) -> FrictionType {
    previous?.successor ?? .countdown
}

/// The level of the gate shown for the `attemptCount`-th attempt (0 attempts reads as L0).
func levelOf(_ attemptCount: Int) -> Int {
    min(max(attemptCount - 1, 0), 3)
}

func pauseSecondsOf(level: Int, brokenCount: Int, guardianLinked: Bool) -> Int {
    let base = level == 0 ? 5 : (level == 3 && !guardianLinked ? 60 : 15)
    return min(base << min(max(brokenCount, 0), maxPauseDoublings), maxPauseSeconds)
}

/// A complete gate: pause, typing and guardian key as §7.1 requires at its level.
func fullGate(attemptCount: Int, brokenCount: Int, frictionType: FrictionType, guardianLinked: Bool) -> Gate {
    let level = levelOf(attemptCount)
    return Gate(
        level: level,
        pauseSeconds: pauseSecondsOf(level: level, brokenCount: brokenCount, guardianLinked: guardianLinked),
        frictionType: frictionType,
        requiresTypedIntention: level >= 2,
        requiresGuardianKey: level == 3 && guardianLinked
    )
}

/// The short extension gate (§7.3 `extend`): the doubled pause, no typing and no key.
func extensionGate(attemptCount: Int, brokenCount: Int, frictionType: FrictionType, guardianLinked: Bool) -> Gate {
    var gate = fullGate(
        attemptCount: attemptCount,
        brokenCount: brokenCount,
        frictionType: frictionType,
        guardianLinked: guardianLinked
    )
    gate.requiresTypedIntention = false
    gate.requiresGuardianKey = false
    return gate
}
