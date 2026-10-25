// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.ComponentName
import dev.monkifocus.android.core.domain.engine.RulesCatalog
import dev.monkifocus.android.core.domain.ports.BypassEventOutbox
import dev.monkifocus.android.core.domain.ports.EscalationStateRepository
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import dev.monkifocus.android.core.domain.rules.Ruleset
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.service.accessibility.notice.ProtectionNotifier

/**
 * What the app's composition root (`AppGraph`) hands the protection: the
 * bundled rules data, the Room repositories behind the domain ports, the
 * notifier and our device-admin receiver. Keeps this module free of
 * `:core-data` and of the app's assets.
 */
interface ProtectionInputs {
    val catalog: RulesCatalog
    val packLoader: DetectorPackLoader

    /** Pack id → bytes of the packs bundled in the APK (blocking I/O: call off the main thread). */
    fun bundledPacks(): Map<String, ByteArray>

    /** The rule set in force at [now] (UTC RFC 3339), or the bundled starter preset before the first commit. */
    suspend fun activeRuleset(now: String): Ruleset

    val escalationStates: EscalationStateRepository
    val intentions: IntentionRepository
    val bypassOutbox: BypassEventOutbox
    val notifier: ProtectionNotifier

    /** Our `DeviceAdminReceiver`, disarmed at the end of the exit flow. */
    val deviceAdmin: ComponentName

    /** Our app and service names as the user sees them (the guard looks for them). */
    val ownLabels: Set<String>
}
