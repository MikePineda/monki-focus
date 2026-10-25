// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.app.Application
import android.content.ComponentName
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.ports.BypassEvent
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox
import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import dev.monkifocus.android.core.domain.rules.EscalationState
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.service.accessibility.notice.NoticeContent
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotifier
import dev.monkifocus.android.service.accessibility.support.RulesData
import dev.monkifocus.android.service.accessibility.support.aRuleset
import java.util.Collections

/** The Robolectric application of the wiring tests: the real [ProtectionGraph] over in-memory ports. */
class TestProtectionApplication :
    Application(),
    ProtectionGraphProvider {
    val outbox = MemoryOutbox()
    val notices: MutableList<Boolean> = Collections.synchronizedList(mutableListOf())

    override val protectionGraph: ProtectionGraph by lazy { ProtectionGraph(this, Inputs()) }

    private inner class Inputs : ProtectionInputs {
        override val catalog: RulesCatalog get() = RulesData.catalog
        override val packLoader: DetectorPackLoader get() = RulesData.loader

        override fun bundledPacks(): Map<String, ByteArray> = RulesData.packIds.associateWith(RulesData::packBytes)

        override suspend fun activeRuleset(now: String): Ruleset = aRuleset()

        override val escalationStates: EscalationStateRepository = MemoryEscalation()
        override val intentions: IntentionRepository = MemoryIntentions()
        override val bypassOutbox: BypassEventOutbox get() = outbox
        override val notifier: ProtectionNotifier =
            object : ProtectionNotifier {
                override fun reconcile(
                    protectionActive: Boolean,
                    content: NoticeContent,
                ) {
                    notices += protectionActive
                }

                override fun dismissed() = Unit
            }
        override val deviceAdmin: ComponentName get() = ComponentName(this@TestProtectionApplication, "dev.monkifocus.test.Admin")
        override val ownLabels: Set<String> = setOf("monki-focus")
    }
}

class MemoryOutbox : BypassEventOutbox {
    val events: MutableList<BypassEvent> = Collections.synchronizedList(mutableListOf())

    override suspend fun enqueue(event: BypassEvent): Boolean = if (events.any { it.id == event.id }) false else events.add(event)

    override suspend fun unreported(limit: Int): List<BypassEvent> = events.take(limit)

    override suspend fun markReported(
        ids: List<String>,
        reportedAt: String,
    ) = Unit

    override suspend fun occurredBetween(
        from: String,
        to: String,
    ): List<BypassEvent> = events.toList()

    override suspend fun purgeReportedBefore(before: String): Int = 0
}

private class MemoryEscalation : EscalationStateRepository {
    private val states = mutableMapOf<String, EscalationState>()

    override suspend fun all(): List<EscalationState> = states.values.toList()

    override suspend fun get(targetGroup: String): EscalationState? = states[targetGroup]

    override suspend fun put(state: EscalationState) {
        states[state.targetGroup] = state
    }

    override suspend fun putAll(states: List<EscalationState>) = states.forEach { put(it) }

    override suspend fun remove(targetGroup: String): Boolean = states.remove(targetGroup) != null
}

private class MemoryIntentions : IntentionRepository {
    private val intentions = mutableListOf<Intention>()

    override suspend fun start(intention: Intention) {
        intentions += intention
    }

    override suspend fun close(
        id: String,
        outcome: IntentionOutcome,
        closedAt: String,
    ): Boolean = false

    override suspend fun open(targetGroup: String): Intention? = intentions.lastOrNull { it.targetGroup == targetGroup }

    override suspend fun startedBetween(
        from: String,
        to: String,
    ): List<Intention> = intentions.toList()
}
