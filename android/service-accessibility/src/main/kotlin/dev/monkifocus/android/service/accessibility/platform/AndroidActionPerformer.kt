// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.SystemClock
import android.view.inputmethod.InputMethodManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import dev.monkifocus.android.feature.gate.state.GateUiState
import dev.monkifocus.android.service.accessibility.action.ActionPerformer
import dev.monkifocus.android.service.accessibility.action.GateHost
import dev.monkifocus.android.service.accessibility.action.ImeProbe
import dev.monkifocus.android.service.accessibility.action.OverlayContent

/**
 * [ActionPerformer] on the device: global actions through the service, our
 * screens in the [OverlayHost], and a prompt that needs the keyboard in
 * `GateActivity` when [GateHost] says the overlay cannot be trusted with it.
 *
 * While a prompt is in the overlay the [ImeProbe] samples twice a second;
 * a failure is remembered for the device ([ProtectionPreferences]) and the
 * prompt moves to the activity at once.
 */
internal class AndroidActionPerformer(
    private val service: AccessibilityService,
    private val overlay: OverlayHost,
    private val relay: GateRelay,
    private val preferences: ProtectionPreferences,
    private val handler: Handler,
) : ActionPerformer {
    private val probe = ImeProbe()
    private var shown: OverlayContent? = null
    private var inActivity = false
    private val sample =
        object : Runnable {
            override fun run() {
                val asking = (shown as? OverlayContent.Gate)?.state is GateUiState.Asking
                val view = overlay.rootView
                if (!asking || view == null) return
                val ime = ViewCompat.getRootWindowInsets(view)?.isVisible(WindowInsetsCompat.Type.ime()) == true
                val served = service.getSystemService(InputMethodManager::class.java)?.isAcceptingText == true && view.hasWindowFocus()
                if (probe.sample(served, ime, SystemClock.elapsedRealtime())) {
                    preferences.overlayImeFailed = true
                    shown?.let(::show)
                } else {
                    handler.postDelayed(this, PROBE_INTERVAL_MS)
                }
            }
        }

    override fun back() {
        service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_BACK)
    }

    override fun home() {
        service.performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME)
    }

    override fun show(content: OverlayContent) {
        val previous = shown
        shown = content
        val gate = content as? OverlayContent.Gate
        if (gate != null && GateHost.choose(gate.state, Build.VERSION.SDK_INT, preferences.overlayImeFailed) == GateHost.ACTIVITY) {
            handler.removeCallbacks(sample)
            overlay.clear()
            inActivity = true
            // GateActivity resets the relay when it stops: a gate nobody sees is launched again.
            val launch = relay.content.value == null || !relay.activityVisible
            relay.post(content)
            if (launch) startGateActivity()
            return
        }
        inActivity = false
        relay.post(null)
        val asking = gate?.state is GateUiState.Asking
        overlay.show(content, focusable = asking)
        val newPrompt = asking && (previous as? OverlayContent.Gate)?.state !is GateUiState.Asking
        if (newPrompt) {
            probe.reset()
            handler.removeCallbacks(sample)
            handler.postDelayed(sample, PROBE_INTERVAL_MS)
        } else if (!asking) {
            handler.removeCallbacks(sample)
        }
    }

    override fun isOnTop(): Boolean = if (inActivity) relay.activityVisible else overlay.attached

    override fun clear() {
        shown = null
        inActivity = false
        handler.removeCallbacks(sample)
        relay.post(null)
        overlay.clear()
    }

    private fun startGateActivity() {
        val intent =
            Intent(service, GateActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
        runCatching { service.startActivity(intent) }
    }

    private companion object {
        const val PROBE_INTERVAL_MS = 500L
    }
}
