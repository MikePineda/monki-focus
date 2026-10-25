// SPDX-License-Identifier: AGPL-3.0-or-later

/// Verified unlocks (SEMANTICS.md §5.2): an unlock whose target matches the
/// observation and with `notBefore ≤ now < expiresAt` lifts any restriction,
/// bedtime included. Adapters verify signature, device and replay before an
/// unlock reaches the engine; the engine only checks time and target.
func hasActiveUnlock(
    _ unlocks: [VerifiedUnlock],
    _ observation: ResolvedObservation,
    _ nowSeconds: Int,
    _ catalog: RulesCatalog
) throws -> Bool {
    for unlock in unlocks {
        let starts = try epochSecondsOf(unlock.notBefore)
        let ends = try epochSecondsOf(unlock.expiresAt)
        if starts <= nowSeconds, nowSeconds < ends, matchesTarget(unlock.target, observation, catalog) {
            return true
        }
    }
    return false
}
