// SPDX-License-Identifier: AGPL-3.0-or-later

// `Decision.validUntil` (SEMANTICS.md §5.6): the earliest instant `t` in
// `(now, now + 24 h]` at which `decide` with the same inputs returns a
// decision that differs in any other field, else `now + 24 h`; never later
// than a waiting rule change (`state.pendingEffectiveFrom`). Adapters
// re-decide then at the latest instead of polling. It is computed exactly:
// the decision is evaluated again at every instant where it can change, in
// order, and the first one that differs wins.

let validityHorizonSeconds = 86_400

/// `decision` is the decision at `nowSeconds` without its validity (`validUntil` nil).
func validUntilOf(
    _ subject: DecisionSubject,
    _ state: DecisionState,
    decision: Decision,
    nowSeconds: Int,
    decisionAt: (Int) throws -> Decision
) throws -> String {
    var horizon = nowSeconds + validityHorizonSeconds
    if let pendingText = state.pendingEffectiveFrom {
        let pending = try epochSecondsOf(pendingText)
        if pending > nowSeconds { horizon = min(horizon, pending) }
    }
    for instant in try changeInstants(subject, state, nowSeconds: nowSeconds, horizon: horizon) {
        if try decisionAt(instant) != decision { return utcInstantOf(instant) }
    }
    return utcInstantOf(horizon)
}
