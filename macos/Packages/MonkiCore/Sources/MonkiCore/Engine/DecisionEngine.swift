// SPDX-License-Identifier: AGPL-3.0-or-later

// The throwing core of `decide(ruleset, observation, state, now, catalog) →
// Decision` (SEMANTICS.md §5); the public `decide` wraps it fail-closed
// (`FailClosedDecision`, §14). Two independent axes, access and content, each
// choose a winner among the enabled, scheduled, matching rules. Access
// restrictions are checked in order (bedtime, budget, rule block, friction);
// each one either applies or is lifted (unlock, emergency override,
// intention). `validUntil` (§5.6) evaluates the same inputs again at the
// instants where the outcome can change (`DecisionValidity`).

/// A restriction of §5.2 that matched; `group` is its escalation group.
private struct Restriction {
    let access: Access
    let reason: ReasonCode
    let ruleId: String?
    let group: String
    /// Friction: an active intention lifts it and an unlifted one shows a gate.
    var friction: (winner: Rule, frictionRules: [Rule])?
}

private struct AccessOutcome {
    let access: Access
    let reason: ReasonCode
    let ruleId: String?
    var gate: Gate?
}

/// Everything a decision reads: the subject, the state, and the time-independent bedtime level.
struct DecisionInputs {
    let subject: DecisionSubject
    let state: DecisionState
    let categoryLevel: Int
}

private func liftOf(_ restriction: Restriction, _ inputs: DecisionInputs, _ nowSeconds: Int) throws -> ReasonCode? {
    let state = inputs.state
    if try hasActiveUnlock(state.unlocks, inputs.subject.observation, nowSeconds, inputs.subject.catalog) {
        return .unlockActive
    }
    if try isOverrideActive(state.escalation, group: restriction.group, nowSeconds) { return .emergencyActive }
    if restriction.friction != nil, try isIntentionActive(state.escalation, group: restriction.group, nowSeconds) {
        return .intentionActive
    }
    return nil
}

private func restrictionsOf(
    _ inputs: DecisionInputs,
    _ nowSeconds: Int,
    budgetCandidates: [Rule],
    access: [AccessCandidate],
    winner: AccessCandidate?
) -> [Restriction] {
    let subject = inputs.subject
    var restrictions: [Restriction] = []
    if isBedtimeActive(subject.ruleset.bedtime, nowSeconds, zones: subject.zones),
        inputs.categoryLevel <= bedtimeMaxLevel
    {
        restrictions.append(
            Restriction(access: .block, reason: .scheduleBedtime, ruleId: nil, group: bedtimeGroup)
        )
    }
    if let budget = exhaustedBudgetRule(
        budgetCandidates,
        usage: inputs.state.usage,
        todayDates: localDatesAt(nowSeconds, zones: subject.zones),
        subject.catalog
    ) {
        restrictions.append(
            Restriction(access: .block, reason: .budgetExhausted, ruleId: budget.id, group: budget.id)
        )
    }
    if let winner, winner.mode == .block {
        restrictions.append(
            Restriction(access: .block, reason: .ruleMatch, ruleId: winner.rule.id, group: winner.rule.id)
        )
    }
    if let winner, winner.mode == .friction {
        restrictions.append(
            Restriction(
                access: .gate,
                reason: .intentionRequired,
                ruleId: winner.rule.id,
                group: winner.rule.id,
                friction: (winner.rule, frictionRulesOf(access))
            )
        )
    }
    return restrictions
}

private func accessOutcome(
    _ inputs: DecisionInputs,
    _ nowSeconds: Int,
    _ restrictions: [Restriction],
    winner: AccessCandidate?
) throws -> AccessOutcome {
    var firstLift: AccessOutcome?
    for restriction in restrictions {
        if let lift = try liftOf(restriction, inputs, nowSeconds) {
            if firstLift == nil {
                firstLift = AccessOutcome(access: .allow, reason: lift, ruleId: restriction.ruleId)
            }
            continue
        }
        guard let friction = restriction.friction else {
            return AccessOutcome(access: restriction.access, reason: restriction.reason, ruleId: restriction.ruleId)
        }
        let gate = try decisionGate(
            winner: friction.winner,
            frictionRules: friction.frictionRules,
            states: inputs.state.escalation,
            nowSeconds: nowSeconds,
            guardianLinked: inputs.state.guardianLinked
        )
        return AccessOutcome(
            access: restriction.access,
            reason: restriction.reason,
            ruleId: restriction.ruleId,
            gate: gate
        )
    }
    if let firstLift { return firstLift }
    guard let winner else { return AccessOutcome(access: .allow, reason: .noRule, ruleId: nil) }
    return AccessOutcome(access: .allow, reason: .ruleMatch, ruleId: winner.rule.id)
}

/// §5.4: the access outcome, unless access merely allows and a hide-feed rule wins the content axis.
private func primaryOutcome(_ access: AccessOutcome, _ content: ContentOutcome) -> (
    reason: ReasonCode, ruleId: String?
) {
    let accessIsPlain = access.access == .allow && (access.reason == .ruleMatch || access.reason == .noRule)
    if accessIsPlain, let winner = content.winner, winner.mode == .hideFeed {
        return (content.reason, winner.id)
    }
    return (access.reason, access.ruleId)
}

/// Validates the inputs (§14) and resolves what does not depend on the instant.
func decisionInputsOf(
    _ ruleset: Ruleset,
    _ observation: Observation,
    _ state: DecisionState,
    now: String,
    _ catalog: RulesCatalog
) throws -> (inputs: DecisionInputs, nowSeconds: Int) {
    let checked = try guardDecisionInputs(ruleset, observation, state, now: now)
    let resolved = ResolvedObservation(observation, catalog)
    let subject = DecisionSubject(ruleset: ruleset, zones: checked.zones, observation: resolved, catalog: catalog)
    let level = categoryLevelOf(resolved, userAssignments: ruleset.categories, catalog)
    return (DecisionInputs(subject: subject, state: state, categoryLevel: level), checked.seconds)
}

/// The decision at an instant, without `validUntil`.
func decisionAt(_ inputs: DecisionInputs, _ nowSeconds: Int) throws -> Decision {
    let subject = inputs.subject
    let pools = candidatePoolsAt(subject, nowSeconds)
    let access = accessCandidates(pools.access, subject.observation, subject.catalog)
    let winner = accessWinner(access, unknownPath: subject.unknownPath, subject.catalog)
    let restrictions = restrictionsOf(
        inputs,
        nowSeconds,
        budgetCandidates: pools.access,
        access: access,
        winner: winner
    )
    let outcome = try accessOutcome(inputs, nowSeconds, restrictions, winner: winner)
    let content = contentOutcome(pools.matching, subject.observation, subject.catalog)
    let primary = primaryOutcome(outcome, content)
    return Decision(
        access: outcome.access,
        content: content.content,
        ruleId: primary.ruleId,
        reason: primary.reason,
        gate: outcome.gate,
        explanationKey: ExplanationKey.of(access: outcome.access, content: content.content, reason: primary.reason),
        validUntil: nil
    )
}

func decideOrThrow(
    _ ruleset: Ruleset,
    _ observation: Observation,
    _ state: DecisionState,
    now: String,
    _ catalog: RulesCatalog
) throws -> Decision {
    let (inputs, nowSeconds) = try decisionInputsOf(ruleset, observation, state, now: now, catalog)
    var decision = try decisionAt(inputs, nowSeconds)
    decision.validUntil = try validUntilOf(
        inputs.subject,
        inputs.state,
        decision: decision,
        nowSeconds: nowSeconds
    ) { try decisionAt(inputs, $0) }
    return decision
}
