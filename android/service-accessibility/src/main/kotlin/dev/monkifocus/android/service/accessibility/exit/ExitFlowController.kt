// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.exit

import dev.monkifocus.android.service.accessibility.bypass.BypassKind
import dev.monkifocus.android.service.accessibility.bypass.BypassRecorder

/**
 * Runs [ExitFlow] against its store and [clock], shared by the app screen,
 * the bounce card and the notification action (one instance per process).
 * Whoever is alive (the service's tick or the app screen's) calls [tick];
 * the end is applied once: the state is saved as ended first, so a
 * device-admin callback that follows sees a deliberate exit, then each
 * effect runs on its own and a failing one never stops the others.
 *
 * [disarmer] is attached by the running service; without it (service off)
 * the exit still records its event and disarms the device admin through
 * [fallbackDisarmer].
 */
class ExitFlowController(
    private val store: ExitFlowStore,
    private val bypasses: BypassRecorder,
    private val fallbackDisarmer: ProtectionDisarmer,
    private val clock: ExitClock,
) {
    var disarmer: ProtectionDisarmer? = null

    val state: ExitFlowState get() = store.load()

    val protectionEnded: Boolean get() = state is ExitFlowState.Ended

    fun request(): ExitFlowState = apply(ExitFlow.request(state, clock.now()))

    fun cancel(): ExitFlowState = apply(ExitFlow.cancel(state))

    /** Answers true when this call ended protection. */
    fun tick(): Boolean {
        val transition = ExitFlow.tick(state, clock.now())
        apply(transition)
        return transition.effects.isNotEmpty()
    }

    /** "Turn protection back on" in our app, after an exit: the next service start re-arms. */
    fun allowRearm(): ExitFlowState = apply(ExitFlow.allowRearm(state))

    /** The system bound the service. */
    fun connect(): ServiceStart {
        val (transition, start) = ExitFlow.connect(state)
        apply(transition)
        return start
    }

    fun remainingSeconds(): Int? = ExitFlow.remainingSeconds(state, clock.now())

    private fun apply(transition: ExitFlow.Transition): ExitFlowState {
        if (transition.state != state) store.save(transition.state)
        val target = disarmer ?: fallbackDisarmer
        for (effect in transition.effects) {
            runCatching {
                when (effect) {
                    ExitFlowEffect.RECORD_PROTECTION_ENDED -> bypasses.record(BypassKind.PROTECTION_ENDED, clock.now().wallMs)
                    ExitFlowEffect.DISARM_DEVICE_ADMIN -> target.disarmDeviceAdmin()
                    ExitFlowEffect.STOP_PROTECTION -> target.stopProtection()
                }
            }
        }
        return transition.state
    }
}
