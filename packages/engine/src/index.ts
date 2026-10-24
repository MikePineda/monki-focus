// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @monki-focus/engine: the pure decision engine shared by the extension and
 * the server. It implements packages/rules/SEMANTICS.md and runs its
 * fixtures. No clock, no I/O, no browser or Node APIs: the clock, the rules
 * data and every input are parameters.
 */
export type { RulesCatalog, RulesCatalogInput } from './RulesCatalog.ts'
export { createRulesCatalog } from './RulesCatalog.ts'
export { epochSecondsOf, instantOf, utcInstantOf } from './Instant.ts'
export { normalizeUrl } from './UrlNormalizer.ts'
export { ENGINE_ERROR_DECISION, decide } from './FailClosedDecision.ts'
export type { EscalationResult } from './EscalationPolicy.ts'
export { nextEscalation } from './EscalationPolicy.ts'
export { effectiveEscalationState } from './DecisionGate.ts'
export { initialEscalationState } from './EscalationSession.ts'
export type { EffectiveRuleSet } from './RuleChangePolicy.ts'
export { effectiveRuleSet } from './RuleChangePolicy.ts'
export { isScheduleActive } from './ScheduleEvaluator.ts'
export type { BedtimePhase } from './BedtimePolicy.ts'
export { bedtimePhase } from './BedtimePolicy.ts'
// Shared with @monki-focus/analytics (categorise, blocks, daily totals), re-exported so
// the analytics core reuses the engine's §2–§4 and zone logic instead of duplicating it.
export type { ResolvedObservation } from './ResolvedObservation.ts'
export { matchesTarget } from './TargetMatcher.ts'
export type { TargetSpecificity } from './Specificity.ts'
export { compareTargetSpecificity, targetSpecificity } from './Specificity.ts'
export type { LocalTime } from './ZonedTime.ts'
export { localTimeAt, nextLocalMidnight } from './ZonedTime.ts'
