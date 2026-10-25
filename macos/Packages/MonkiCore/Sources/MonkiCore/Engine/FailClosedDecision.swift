// SPDX-License-Identifier: AGPL-3.0-or-later

/// The public `decide` (SEMANTICS.md §5, §14): fail closed. Any invalid input
/// while deciding (garbage URL text, an instant without an offset, an
/// unresolvable time zone, a schema-invalid observation) blocks and hides
/// the feed with reason `engine_error` and no gate, so a bug can never open
/// what the user chose to restrict. `validUntil` is nil: there is no instant
/// at which the same broken inputs would decide better. The error itself is
/// not exposed: adapters log the reason code only, never URLs or titles.
public func decide(
    _ ruleset: Ruleset,
    observation: Observation,
    state: DecisionState,
    now: String,
    catalog: RulesCatalog
) -> Decision {
    do {
        return try decideOrThrow(ruleset, observation, state, now: now, catalog)
    } catch {
        return .engineError
    }
}
