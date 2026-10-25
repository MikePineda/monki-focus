// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import dev.monkifocus.android.service.accessibility.action.OverlayContent
import dev.monkifocus.android.service.accessibility.pipeline.UserAction
import dev.monkifocus.android.service.accessibility.ui.OverlayScreen

/**
 * The fallback host of a gate prompt that needs the keyboard (plan §2.5,
 * risk 2), launched by the service when the overlay cannot be trusted with
 * the IME. Not exported, own task affinity, no recents entry. It shows what
 * the service posts on the [GateRelay] and finishes when the service posts
 * nothing; system BACK is Close, so it never traps the user.
 *
 * It tells the relay when it is really on screen: leaving it (HOME, another
 * app) resets the relay in [onStop], so reopening the watched app launches
 * it again rather than letting the app through behind a gate nobody sees.
 */
class GateActivity : ComponentActivity() {
    private val relay: GateRelay get() = (application as ProtectionGraphProvider).protectionGraph.gateRelay

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val relay = relay
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    relay.act(UserAction.Close)
                }
            },
        )
        setContent {
            val content by relay.content.collectAsState()
            val noticeOff by relay.noticeOff.collectAsState()
            val gate = content as? OverlayContent.Gate
            LaunchedEffect(gate == null) { if (gate == null) finish() }
            gate?.let { OverlayScreen(it, noticeOff = noticeOff, onAction = relay::act) }
        }
    }

    override fun onStart() {
        super.onStart()
        relay.activityStarted()
    }

    override fun onStop() {
        relay.reset()
        super.onStop()
    }
}
