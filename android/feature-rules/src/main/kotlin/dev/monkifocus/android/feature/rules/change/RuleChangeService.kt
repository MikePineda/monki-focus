// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.change

import dev.monkifocus.android.core.domain.engine.EffectiveRuleSet
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.engine.effectiveRuleSet
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.engine.isResolvableTimeZone
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.RulesetChange
import dev.monkifocus.android.core.domain.ports.RulesetRepository
import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.validation.RejectionCode
import dev.monkifocus.android.core.domain.validation.ValidationResult
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * Every rule-set edit on the device goes through here and through the
 * engine's rule-change policy (`effectiveRuleSet`, SEMANTICS.md §8), the
 * twin of the extension's `RuleChangeService`: what only tightens applies at
 * once; when anything loosens, today gets only the parts that apply now and
 * the whole proposal waits in the repository until `effectiveFrom`, which a
 * later change never moves earlier. A pending revision becomes active by the
 * passage of time alone, so nothing has to promote it.
 *
 * Guarantees, each with its test: the proposal and what would apply today
 * are validated before anything is saved; a screen that edited an older set
 * is refused (`stale_revision`); while a time-zone change waits a third zone
 * is refused and the second one is never dropped early; when the stored set
 * cannot be judged the proposal waits in full, never less than the next
 * midnight of every zone involved (the stored set's included, never only the
 * proposal's). Operations run one at a time ([lock]): a read, judge and
 * write never interleaves with another; the repository is the single writer.
 *
 * Before the first commit the bundled [starter] is what applies, as for the
 * accessibility service.
 */
class RuleChangeService(
    private val repository: RulesetRepository,
    private val catalog: RulesCatalog,
    private val check: RulesetCheck,
    private val starter: () -> Ruleset,
    private val clock: Clock,
) {
    private val lock = Mutex()

    /** What applies now and what waits. */
    suspend fun state(): RulesState = lock.withLock { read(now()) }

    /**
     * Stores the bundled starter as the first revision (source `preset`),
     * pinned to [deviceZone] as it is at this moment, when nothing is stored
     * yet; from then on the stored zone governs every decision, whatever the
     * device zone does (SEMANTICS.md §6.3). Idempotent: answers whether it
     * stored anything. Called on the app's first start and when protection
     * is armed.
     */
    suspend fun ensureStored(deviceZone: String): Boolean =
        lock.withLock {
            val now = now()
            if (repository.active(now) != null || repository.pending(now) != null) return@withLock false
            val base = starter()
            val starter = if (isResolvableTimeZone(deviceZone)) base.copy(timeZone = deviceZone, pendingTimeZone = null) else base
            repository.commit(RulesetChange(starter, starter, null, RulesetSource.PRESET), now)
            true
        }

    /**
     * Proposes [proposal] as the configured rule set. [baseRevision] is the
     * `revision` of the configured set the screen edited (optimistic lock).
     * The service assigns the revision and `updatedAt`; `pendingTimeZone`
     * belongs to the engine, never to an edit.
     */
    suspend fun propose(
        proposal: Ruleset,
        baseRevision: Int,
        source: RulesetSource = RulesetSource.USER,
    ): RuleChangeOutcome =
        lock.withLock {
            val now = now()
            val current = read(now)
            val configured = current.configured
            if (baseRevision != configured.revision) return@withLock rejected(RuleChangeRejection.STALE_REVISION)
            // Only one zone can wait: a third one would drop the waiting zone at once.
            val waitingZone = current.effective.pendingTimeZone
            if (waitingZone != null && proposal.timeZone != current.effective.timeZone && proposal.timeZone != waitingZone) {
                return@withLock rejected(RuleChangeRejection.ZONE_CHANGE_PENDING)
            }
            val next = proposal.copy(revision = configured.revision + 1, updatedAt = now, pendingTimeZone = null)
            val verdict = check.check(next)
            if (verdict is ValidationResult.Rejected) return@withLock rejected(RuleChangeRejection.of(verdict.code))

            val judged =
                if (check.check(current.effective) is ValidationResult.Valid) {
                    runCatching { effectiveRuleSet(current.effective, next, now, current.pending?.effectiveFrom, catalog) }.getOrNull()
                } else {
                    null
                }
            // The stored set cannot be compared with: it stays (the engine fails closed on it) and the proposal waits in full.
            if (judged == null) return@withLock commit(current.effective, next, fallbackEffectiveFrom(current, next, now), source, now)

            val (today, effectiveFrom) = keepWaitingZone(current, now, judged)
            // What applies today must itself be a valid set, or it would be stored and later read as unreadable.
            val todayVerdict = check.check(today)
            if (todayVerdict is ValidationResult.Rejected) return@withLock rejected(todayRejection(today, todayVerdict.code))
            commit(today, next, effectiveFrom, source, now)
        }

    /** [propose] of [transform] applied to the configured set of [seen], against its revision. */
    suspend fun edit(
        seen: RulesState,
        source: RulesetSource = RulesetSource.USER,
        transform: (Ruleset) -> Ruleset,
    ): RuleChangeOutcome = propose(transform(seen.configured), seen.configured.revision, source)

    /**
     * Drops the pending change: what applies now stays, nothing gets looser.
     * What applies gets the next revision, so screens that edited the
     * cancelled set are refused. A waiting time-zone change leaves
     * `pendingTimeZone` in force (both zones apply); removing it is a
     * loosening, so it stays pending until the cancelled `effectiveFrom`.
     */
    suspend fun cancelPending(): RulesState =
        lock.withLock {
            val now = now()
            val current = read(now)
            val pending = current.pending ?: return@withLock current
            val effective = current.effective.copy(revision = current.configured.revision + 1, updatedAt = now)
            if (effective.pendingTimeZone == null) {
                repository.commit(RulesetChange(effective, effective, null, RulesetSource.USER), now)
                return@withLock RulesState(effective, null)
            }
            val next = effective.copy(pendingTimeZone = null)
            val from = repository.commit(RulesetChange(effective, next, pending.effectiveFrom, RulesetSource.USER), now)
            RulesState(effective, PendingRuleChange(next, from))
        }

    private suspend fun commit(
        today: Ruleset,
        next: Ruleset,
        effectiveFrom: String?,
        source: RulesetSource,
        now: String,
    ): RuleChangeOutcome {
        if (effectiveFrom == null) {
            repository.commit(RulesetChange(next, next, null, source), now)
            return RuleChangeOutcome.Applied(RulesState(next, null))
        }
        val stored = repository.commit(RulesetChange(today, next, effectiveFrom, source), now)
        return RuleChangeOutcome.Pending(stored, RulesState(today, PendingRuleChange(next, stored)))
    }

    /**
     * While a time-zone change waits, the stored set carries
     * `pendingTimeZone` (both zones apply, the stricter wins). A proposal in
     * the stored zone (after a cancel, or reverting the zone) would let the
     * engine drop the second zone at once: that is a loosening, so the second
     * zone stays in what applies today and its removal waits, never earlier
     * than the pending change it replaces.
     */
    private fun keepWaitingZone(
        current: RulesState,
        now: String,
        judged: EffectiveRuleSet,
    ): Pair<Ruleset, String?> {
        val waitingZone = current.effective.pendingTimeZone
        val today = judged.effectiveToday
        if (waitingZone == null || today.pendingTimeZone != null || today.timeZone != current.effective.timeZone) {
            return today to judged.effectiveFrom
        }
        val candidates = listOfNotNull(judged.effectiveFrom, current.pending?.effectiveFrom).map(::epochSecondsOf).toMutableList()
        // No record of when the zone change ends: wait for both zones' midnight.
        if (candidates.isEmpty()) candidates += listOf(today.timeZone, waitingZone).map { nextMidnightOrDay(epochSecondsOf(now), it) }
        return today.copy(pendingTimeZone = waitingZone) to utcInstantOf(candidates.max())
    }

    /**
     * `effectiveFrom` when the stored set cannot be judged: the latest next
     * local midnight of every zone involved (the stored set's zones, never
     * only the proposal's), a full day when a zone does not resolve, and
     * never earlier than a pending change.
     */
    private fun fallbackEffectiveFrom(
        current: RulesState,
        next: Ruleset,
        now: String,
    ): String {
        val nowSeconds = epochSecondsOf(now)
        val zones = listOfNotNull(current.effective.timeZone, next.timeZone, current.effective.pendingTimeZone)
        val candidates =
            zones.map { nextMidnightOrDay(nowSeconds, it) } + listOfNotNull(current.pending?.effectiveFrom?.let(::epochSecondsOf))
        return utcInstantOf(candidates.max())
    }

    private suspend fun read(now: String): RulesState {
        val effective = repository.active(now)?.ruleset ?: starter()
        val pending = repository.pending(now)?.let { PendingRuleChange(it.ruleset, it.effectiveFrom) }
        return RulesState(effective, pending)
    }

    private fun now(): String = instantOf(clock.millis())

    private fun rejected(code: RuleChangeRejection) = RuleChangeOutcome.Rejected(code)

    private companion object {
        const val MAX_RULES = 500
        const val DAY_SECONDS = 86_400L

        fun todayRejection(
            today: Ruleset,
            code: RejectionCode,
        ): RuleChangeRejection =
            when {
                today.rules.size > MAX_RULES -> RuleChangeRejection.TOO_MANY_RULES
                code == RejectionCode.TOO_LARGE -> RuleChangeRejection.TOO_LARGE
                else -> RuleChangeRejection.INVALID_RULESET
            }

        /** The next local midnight after [nowSeconds] in [zone], or a full day when the zone does not resolve. */
        fun nextMidnightOrDay(
            nowSeconds: Long,
            zone: String,
        ): Long {
            if (!isResolvableTimeZone(zone)) return nowSeconds + DAY_SECONDS
            val id = ZoneId.of(zone)
            val today = Instant.ofEpochSecond(nowSeconds).atZone(id).toLocalDate()
            return today.plusDays(1).atStartOfDay(id).toEpochSecond()
        }
    }
}
