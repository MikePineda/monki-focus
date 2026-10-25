// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Application
import android.content.ComponentName
import android.view.accessibility.AccessibilityManager
import dev.monkifocus.android.core.data.CoreDataGraph
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox
import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.feature.onboarding.flow.OnboardingController
import dev.monkifocus.android.feature.onboarding.platform.SharedPreferencesOnboardingStore
import dev.monkifocus.android.feature.rules.change.RuleChangeService
import dev.monkifocus.android.feature.rules.change.RulesetCheck
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotifier
import dev.monkifocus.android.service.accessibility.platform.MonkiAccessibilityService
import dev.monkifocus.android.service.accessibility.platform.ProtectionGraph
import dev.monkifocus.android.service.accessibility.platform.ProtectionInputs
import java.time.Clock
import dev.monkifocus.android.core.ui.R as CoreUiR

/**
 * Composition root (manual DI): constructor injection, one `lazy` per
 * singleton, an interface per domain port. The only place that touches the
 * system clock; domain code receives it as a parameter.
 */
class AppGraph(
    val application: Application,
) {
    val wallClock: Clock by lazy { Clock.systemUTC() }

    val data: CoreDataGraph by lazy { CoreDataGraph(application) }

    val rules: BundledRules by lazy { BundledRules(application.assets) }

    private val systemNotifier: ProtectionNotifier by lazy { SystemProtectionNotifier(application) }

    val notifier: ProtectionNotifier get() = systemNotifier

    /**
     * Downloaded detector packs are verified against the pinned
     * `rules-signing` key. No key is pinned in this build yet, so every
     * download is refused and the bundled packs stay active.
     */
    private val packVerifier = SignatureVerifier { _, _ -> false }

    val protection: ProtectionGraph by lazy { ProtectionGraph(application, Inputs()) }

    /** The only way the app changes the rule set: tighten now, loosen later (SEMANTICS.md §8). */
    val ruleChanges: RuleChangeService by lazy {
        RuleChangeService(data.rulesets, rules.catalog, RulesetCheck.of(rules.validator), { rules.starter }, wallClock)
    }

    /** Onboarding progress, resumed across process deaths. */
    val onboarding: OnboardingController by lazy { OnboardingController(SharedPreferencesOnboardingStore(application)) }

    /** Our accessibility service, as Settings names it. */
    val accessibilityService: ComponentName get() = ComponentName(application, MonkiAccessibilityService::class.java)

    /** Our device-admin receiver (uninstall friction only). */
    val deviceAdminReceiver: ComponentName get() = ComponentName(application, MonkiDeviceAdminReceiver::class.java)

    /** Whether the user has our accessibility service turned on in Settings. */
    fun accessibilityServiceEnabled(): Boolean {
        val manager = application.getSystemService(AccessibilityManager::class.java) ?: return false
        val ours = accessibilityService
        return manager
            .getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any { ComponentName.unflattenFromString(it.id) == ours }
    }

    private inner class Inputs : ProtectionInputs {
        override val catalog: RulesCatalog get() = rules.catalog

        override val packLoader: DetectorPackLoader by lazy {
            DetectorPackLoader(rules.validator, packVerifier, rules.surfaces.map { it.id }.toSet())
        }

        override fun bundledPacks(): Map<String, ByteArray> = rules.packs()

        override fun starterRuleset(): Ruleset = rules.starter

        override suspend fun activeRuleset(now: String): Ruleset = data.rulesets.active(now)?.ruleset ?: rules.starter

        override val escalationStates: EscalationStateRepository get() = data.escalationStates
        override val intentions: IntentionRepository get() = data.intentions
        override val bypassOutbox: BypassEventOutbox get() = data.bypassEvents
        override val notifier: ProtectionNotifier get() = systemNotifier
        override val deviceAdmin: ComponentName get() = deviceAdminReceiver
        override val ownLabels: Set<String> get() = setOf(application.getString(CoreUiR.string.app_name))
    }
}
