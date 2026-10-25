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
 */
class GateActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val relay = (application as ProtectionGraphProvider).protectionGraph.gateRelay
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
            val gate = content as? OverlayContent.Gate
            LaunchedEffect(gate == null) { if (gate == null) finish() }
            gate?.let { OverlayScreen(it, onAction = relay::act) }
        }
    }
}
