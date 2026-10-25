// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import dev.monkifocus.android.core.ui.MonkiTheme
import dev.monkifocus.android.service.accessibility.ui.ExitAndUnlinkScreen

/**
 * Launcher entry point, always visible in the launcher (no hidden mode
 * exists). It also opens "Exit and unlink" directly when the protection
 * notice's action asks for it ([EXTRA_OPEN_EXIT]).
 */
class MainActivity : ComponentActivity() {
    private val showExit = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        showExit.value = intent?.getBooleanExtra(EXTRA_OPEN_EXIT, false) == true
        val exitFlow = (application as MonkiApplication).graph.protection.exitFlow
        setContent {
            MonkiTheme {
                if (showExit.value) {
                    ExitAndUnlinkScreen(exitFlow = exitFlow, onDone = { showExit.value = false })
                } else {
                    ScaffoldHomeScreen(onExitAndUnlink = { showExit.value = true })
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_OPEN_EXIT, false)) showExit.value = true
    }

    companion object {
        /** Opens "Exit and unlink" (the protection notice's action). */
        const val EXTRA_OPEN_EXIT = "dev.monkifocus.android.extra.OPEN_EXIT"
    }
}
