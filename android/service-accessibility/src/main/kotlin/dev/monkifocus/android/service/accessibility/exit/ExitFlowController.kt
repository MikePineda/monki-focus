// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

import dev.monkifocus.android.service.accessibility.bypass.BypassKind
import dev.monkifocus.android.service.accessibility.bypass.BypassRecorder

/**
 * Runs [ExitFlow] against its store, shared by the app screen, the bounce
 * card and the notification action (one instance per process). Whoever is
 * alive (the service's tick or the app screen's) calls [tick]; the end is
 * applied once: the state is saved as ended first, so a device-admin
 * callback that follows sees a deliberate exit, then each effect runs on its
 * own and a failing one never stops the others.
 *
 * [disarmer] is attached by the running service; without it (service off)
 * the exit still records its event and disarms the device admin through
 * [fallbackDisarmer].
 */
class ExitFlowController(
    private val store: ExitFlowStore,
    private val bypasses: BypassRecorder,
    private val fallbackDisarmer: ProtectionDisarmer,
) {
    var disarmer: ProtectionDisarmer? = null

    val state: ExitFlowState get() = store.load()

    val protectionEnded: Boolean get() = state is ExitFlowState.Ended

    fun request(nowMs: Long): ExitFlowState = apply(ExitFlow.request(state, nowMs), nowMs)

    fun cancel(nowMs: Long): ExitFlowState = apply(ExitFlow.cancel(state), nowMs)

    /** Answers true when this call ended protection. */
    fun tick(nowMs: Long): Boolean {
        val transition = ExitFlow.tick(state, nowMs)
        apply(transition, nowMs)
        return transition.effects.isNotEmpty()
    }

    /** The user turned the service on again after an exit: protection is back. */
    fun rearm(nowMs: Long): ExitFlowState = apply(ExitFlow.rearm(state), nowMs)

    fun remainingSeconds(nowMs: Long): Int? = ExitFlow.remainingSeconds(state, nowMs)

    private fun apply(
        transition: ExitFlow.Transition,
        nowMs: Long,
    ): ExitFlowState {
        if (transition.state != state) store.save(transition.state)
        val target = disarmer ?: fallbackDisarmer
        for (effect in transition.effects) {
            runCatching {
                when (effect) {
                    ExitFlowEffect.RECORD_PROTECTION_ENDED -> bypasses.record(BypassKind.PROTECTION_ENDED, nowMs)
                    ExitFlowEffect.DISARM_DEVICE_ADMIN -> target.disarmDeviceAdmin()
                    ExitFlowEffect.STOP_PROTECTION -> target.stopProtection()
                }
            }
        }
        return transition.state
    }
}
