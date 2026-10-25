// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.decision

import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.RuleMode
import dev.monkifocus.android.core.domain.rules.Ruleset

/**
 * Holds the inputs `decide` runs with, and never leaves a gap while they
 * load:
 *
 * - on connect the bundled starter preset applies at once ([provisional]),
 *   until the stored rule set arrives ([loaded]); when reading the stored
 *   rules fails before they ever arrived, decisions fail closed
 *   ([loadFailed], `engine_error`);
 * - until the stored escalation is read ([escalationLoaded]), and for good
 *   when reading it keeps failing ([escalationUnavailable]), every friction
 *   group without a known state starts from [ConservativeEscalation]
 *   (level 2), never from an empty state;
 * - the service is the only writer of escalation while it runs, so a state
 *   it produced ([update]) wins over what storage returns later.
 *
 * Main thread only.
 */
class SnapshotHolder {
    private var ruleset: Ruleset? = null
    private var provisional = false
    private val known = LinkedHashMap<String, EscalationState>()
    private val touched = mutableSetOf<String>()
    private var cached: ProtectionSnapshot? = null

    /** True while the stored escalation is unknown: friction groups start conservatively. */
    var escalationUncertain: Boolean = true
        private set

    /** True when the stored rules could not be read: decide fails closed. */
    var loadFailed: Boolean = false
        private set

    val snapshot: ProtectionSnapshot?
        get() {
            cached?.let { return it }
            val rules = ruleset ?: return null
            return ProtectionSnapshot(rules, escalationFor(rules)).also { cached = it }
        }

    /** The bundled starter preset, enforced until the stored rule set is read. */
    fun provisional(starter: Ruleset) {
        if (ruleset != null) return
        ruleset = starter
        provisional = true
        changed()
    }

    /** The stored rule set in force. */
    fun loaded(ruleset: Ruleset) {
        this.ruleset = ruleset
        provisional = false
        loadFailed = false
        changed()
    }

    /** Both at once (tests, and a start where everything is already at hand). */
    fun loaded(
        ruleset: Ruleset,
        storedEscalation: List<EscalationState>,
    ) {
        escalationLoaded(storedEscalation)
        loaded(ruleset)
    }

    /** Reading the stored rules failed: fail closed unless real rules were read before. */
    fun failed() {
        if (ruleset != null && !provisional) return
        ruleset = null
        provisional = false
        loadFailed = true
        changed()
    }

    fun escalationLoaded(stored: List<EscalationState>) {
        for (state in stored) if (state.targetGroup !in touched) known[state.targetGroup] = state
        escalationUncertain = false
        changed()
    }

    /** Reading the stored escalation kept failing: stay conservative. */
    fun escalationUnavailable() {
        escalationUncertain = true
        changed()
    }

    fun update(state: EscalationState) {
        touched += state.targetGroup
        known[state.targetGroup] = state
        changed()
    }

    private fun escalationFor(rules: Ruleset): List<EscalationState> {
        if (!escalationUncertain) return known.values.toList()
        val conservative =
            rules.rules
                .filter { it.enabled && it.mode == RuleMode.FRICTION && it.id !in known }
                .map { ConservativeEscalation.of(it.id) }
        return known.values.toList() + conservative
    }

    private fun changed() {
        cached = null
    }
}
